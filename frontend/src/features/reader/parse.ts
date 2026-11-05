/**
 * The reader feature's public parse(file) extraction API (AD-7): file bytes +
 * kind in; bounded MaterialSections + an honest parsed|failed state out.
 * PDF extraction dynamically imports pdfjs-dist inside parse-pdf only (AD-8);
 * PPT extraction dynamically imports jszip inside parse-pptx only (epic-13
 * T5 — pptx rides the markdown kind, dispatched by the zip magic bytes since
 * ParseInput carries bytes, never filenames); Markdown is a pure sectioner
 * (which lazily loads the same render pipeline the reader renders with — its
 * ids ARE the rendered anchors). parse() never
 * throws — every failure becomes a failed outcome carrying a reason code,
 * mapped to bilingual i18n keys (NFR-5) via PARSE_REASON_MESSAGE_KEY.
 * Per-section text is bounded by the existing 2000-char cap (AD-4); no raw
 * bytes ever leave this module.
 */
import type { MaterialSection, ParseFailureReason } from "@/domain/entities";
import type { UiLanguage } from "@/ai/types";
import { MATERIAL_SECTION_MAX_CHARS } from "@/lib/material-bounds";
import { parsePdf } from "./parse-pdf";
import { parsePptx } from "./parse-pptx";
import { sectionMarkdown } from "./parse-markdown";

export type { ParseFailureReason } from "@/domain/entities";

/** What the attach flows hand over: the file's bytes and the validated kind. */
export interface ParseInput {
  bytes: Uint8Array;
  kind: "pdf" | "markdown";
  /** UI language for fallback titles (「第 N 页」/ "Page N", 「开头」/ "Introduction"); defaults to zh. */
  language?: UiLanguage;
}

/** The parse(file) output (AD-7): sections + honest state, never a throw. */
export interface ParseOutcome {
  sections: MaterialSection[];
  state: "parsed" | "failed";
  /** Set only when state is "failed"; i18n copy via PARSE_REASON_MESSAGE_KEY. */
  reason?: ParseFailureReason;
}

/** Parse-failure reason → bilingual i18n key (errors.* — AppError convention). */
export const PARSE_REASON_MESSAGE_KEY: Record<ParseFailureReason, string> = {
  corrupt: "errors.parseCorrupt",
  encrypted: "errors.parseEncrypted",
  empty: "errors.parseEmpty",
  unknown: "errors.parseUnknown",
};

/** Map a thrown extraction error to its honest reason code. */
export function classifyParseFailure(error: unknown): ParseFailureReason {
  const name = (error as { name?: string } | undefined)?.name;
  if (name === "PasswordException") return "encrypted";
  if (name === "InvalidPDFException") return "corrupt";
  if (name === "InvalidPPTXException") return "corrupt";
  return "unknown";
}

/** The zip local-file-header magic (PK\x03\x04) — a pptx is a zip; plain
 * markdown text never starts with binary control bytes. This is the dispatch
 * signal for the PPT parser on the markdown kind (epic-13 T5): ParseInput is
 * bytes in (AD-7), so the bytes themselves say which extractor runs. */
function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function bound(text: string): string {
  return text.length > MATERIAL_SECTION_MAX_CHARS ? text.slice(0, MATERIAL_SECTION_MAX_CHARS) : text;
}

export async function parseFile(input: ParseInput): Promise<ParseOutcome> {
  try {
    const extracted =
      input.kind === "pdf"
        ? await parsePdf(input.bytes, input.language ?? "zh")
        : isZipBytes(input.bytes)
          ? await parsePptx(input.bytes, input.language ?? "zh")
          : await sectionMarkdown(new TextDecoder("utf-8").decode(input.bytes), input.language ?? "zh");
    const sections = extracted.map((s) => ({ ...s, text: bound(s.text) }));
    if (sections.length === 0) return { sections: [], state: "failed", reason: "empty" };
    return { sections, state: "parsed" };
  } catch (error) {
    return { sections: [], state: "failed", reason: classifyParseFailure(error) };
  }
}

/**
 * The parse(file) → outcome bridge for the attach flows (AD-7 eager parse):
 * runs a material's bytes through the public parse and RETURNS the honest
 * outcome — no persistence here (the caller writes it back through the
 * SetMaterialParseResult mutation, epic P2-8's Apollo seam). Returns null when
 * handed no bytes — that is the re-upload contract, never a fake parse. The
 * pending|failed → parsing transition and the outcome write-back are the
 * caller's (use-parse-material), so this stays a plain async function,
 * testable without React.
 */
import type { MaterialView } from "@/api/views";
import type { UiLanguage } from "@/ai/types";
import { parseFile, type ParseOutcome } from "./parse";

export async function parseMaterialBytes(
  material: MaterialView,
  blob: Blob | undefined,
  options: { language?: UiLanguage } = {},
): Promise<ParseOutcome | null> {
  if (!blob) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return await parseFile({ bytes, kind: material.kind, language: options.language });
  } catch {
    // blob.arrayBuffer() is the only step parseFile does not already guard.
    return { sections: [], state: "failed", reason: "unknown" };
  }
}

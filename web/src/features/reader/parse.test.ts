import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyParseFailure, parseFile } from "./parse";

/**
 * The reader's public parse(file) seam (spec testing seam 1; AD-7): a minimal
 * committed ASCII %PDF-1.4 fixture exercised through pdfjs-dist's legacy build
 * (vitest runs it on the fake worker — jsdom has no Worker), plus an in-test
 * builder for multi-page/edge PDFs, and the Markdown path incl. failure
 * reasons (corrupt / empty; encrypted via the pure reason classifier).
 * Prior art: upload-validation.test.ts pure fixtures.
 */

/**
 * The committed one-page fixture, as bytes. The path goes through
 * fileURLToPath because jsdom's URL realm is not the one Node's fs accepts;
 * the bytes are copied because pdfjs may detach the buffer it is given.
 */
const fixtureBytes = () =>
  new Uint8Array(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "one-page.pdf")));

/**
 * Assemble a minimal ASCII PDF from per-page text lines; object offsets are
 * computed exactly so pdfjs reads the xref without recovery. Helvetica/Type1
 * keeps the fixture ASCII-only (CJK coverage is the markdown sectioner's seam).
 * pdfjs clips text beyond the page MediaBox, so long-page fixtures use a small
 * font with many in-bounds lines rather than one huge line.
 */
function buildPdf(pageLines: string[][], font: { sizePt?: number; leadingPt?: number } = {}): Uint8Array {
  const enc = new TextEncoder();
  const parts: string[] = [];
  const offsets: number[] = new Array(pageLines.length * 2 + 4).fill(0);
  let length = 0;
  const add = (s: string) => {
    parts.push(s);
    length += enc.encode(s).length;
  };
  const mark = (id: number) => {
    offsets[id] = length;
  };

  add("%PDF-1.4\n");
  const fontId = pageLines.length * 2 + 3;
  mark(1);
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = pageLines.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  mark(2);
  add(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageLines.length} >>\nendobj\n`);
  pageLines.forEach((lines, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    mark(pageId);
    add(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    const size = font.sizePt ?? 24;
    const leading = font.leadingPt ?? 28;
    const ops = lines.map((line, j) => `${j === 0 ? "" : `0 -${leading} Td `}( ${line}) Tj`).join(" ");
    const stream = `BT /F1 ${size} Tf 72 720 Td ${ops} ET`;
    mark(contentId);
    add(`${contentId} 0 obj\n<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });
  mark(fontId);
  add(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  const startxref = length;
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  add(xref);
  add(`trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);
  return enc.encode(parts.join(""));
}

describe("parse(file) — PDF path (FR-8 groundwork, AD-8 legacy build)", () => {
  it("committed fixture: one page → section page-1 titled by its first heading-like line", async () => {
    const outcome = await parseFile({ bytes: fixtureBytes(), kind: "pdf" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.reason).toBeUndefined();
    expect(outcome.sections).toHaveLength(1);
    expect(outcome.sections[0].id).toBe("page-1");
    expect(outcome.sections[0].title).toBe("Introduction");
    expect(outcome.sections[0].text).toContain("Synapse reader fixture page one.");
  });

  it("multi-page: page-N ids in order, each page titled from its own first line", async () => {
    const outcome = await parseFile({
      bytes: buildPdf([
        ["Chapter One", "Body of page one."],
        ["Chapter Two", "Body of page two."],
      ]),
      kind: "pdf",
    });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections.map((s) => s.id)).toEqual(["page-1", "page-2"]);
    expect(outcome.sections.map((s) => s.title)).toEqual(["Chapter One", "Chapter Two"]);
    expect(outcome.sections[1].text).toContain("Body of page two.");
  });

  it("a page whose first line reads as a sentence falls back to the bilingual page title", async () => {
    const bytes = buildPdf([["This is body text that just ends with a period.", "More prose."]]);
    const zh = await parseFile({ bytes, kind: "pdf" });
    expect(zh.sections[0].title).toBe("第 1 页");
    const en = await parseFile({ bytes, kind: "pdf", language: "en" });
    expect(en.sections[0].title).toBe("Page 1");
  });

  it("per-section text is bounded by the existing 2000-char cap (AD-4)", async () => {
    // 40 short lines at 4pt stay inside the MediaBox (pdfjs clips out-of-bounds
    // glyphs) while still exceeding the 2000-char cap in total
    const lines = Array.from({ length: 40 }, () => "x".repeat(250));
    const outcome = await parseFile({ bytes: buildPdf([lines], { sizePt: 4, leadingPt: 6 }), kind: "pdf" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections).toHaveLength(1);
    expect(outcome.sections[0].text.length).toBe(2000);
    expect(outcome.sections[0].title).toBe("第 1 页"); // a 250-char first line is not heading-like
  });

  it("garbage bytes fail honestly with the corrupt reason (never a throw, never fake success)", async () => {
    const outcome = await parseFile({ bytes: new TextEncoder().encode("definitely not a pdf"), kind: "pdf" });
    expect(outcome.state).toBe("failed");
    expect(outcome.reason).toBe("corrupt");
    expect(outcome.sections).toEqual([]);
  });

  it("a zero-page document fails with the empty reason", async () => {
    const outcome = await parseFile({ bytes: buildPdf([]), kind: "pdf" });
    expect(outcome.state).toBe("failed");
    expect(outcome.reason).toBe("empty");
  });
});

describe("parse(file) — Markdown path (FR-9 groundwork)", () => {
  it("parses CJK + duplicate headings through the same sectioner", async () => {
    const md = ["# 第一章: 引言", "内容一。", "# 第一章: 引言", "内容二。"].join("\n");
    const outcome = await parseFile({ bytes: new TextEncoder().encode(md), kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections.map((s) => s.id)).toEqual(["第一章-引言", "第一章-引言-1"]);
  });

  it("per-section markdown text is bounded by the existing 2000-char cap (AD-4)", async () => {
    const md = `# Long\n${"y".repeat(5000)}`;
    const outcome = await parseFile({ bytes: new TextEncoder().encode(md), kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections[0].text.length).toBe(2000);
  });

  it("empty markdown fails with the empty reason", async () => {
    const outcome = await parseFile({ bytes: new TextEncoder().encode("   \n\t\n"), kind: "markdown" });
    expect(outcome.state).toBe("failed");
    expect(outcome.reason).toBe("empty");
  });
});

describe("parse(file) — reason classifier (encrypted needs no fixture: the seam is the error shape)", () => {
  it("pdfjs password errors map to encrypted", () => {
    expect(classifyParseFailure({ name: "PasswordException", message: "No password given" })).toBe("encrypted");
  });

  it("pdfjs structure errors map to corrupt, anything else to unknown", () => {
    expect(classifyParseFailure({ name: "InvalidPDFException", message: "Invalid PDF structure." })).toBe("corrupt");
    expect(classifyParseFailure(new Error("boom"))).toBe("unknown");
    expect(classifyParseFailure(undefined)).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import type { UiLanguage } from "@/ai/types";
import { parsePdf } from "./parse-pdf";

/**
 * parsePdf direct (epic P3-17 ticket 09): the pdfjs path was built to run
 * under vitest's fake worker (see the module header), so the fixture is a
 * real minimal PDF BUILT in-test — byte offsets computed, standard-14
 * Helvetica, no font data needed for text extraction. Pins the page contract
 * the rest of the reader consumes: `page-N` ids, heading-like first line as
 * title, the honest bilingual page fallback when the page opens like prose,
 * and the zero-page → [] shape parseFile reports.
 * Prior art: parse-pptx.test.ts (in-test fixture building).
 */

interface PageSpec {
  /** The page's single text line (one Tj op). */
  text: string;
}

function buildPdf(pages: PageSpec[]): Uint8Array {
  const catalogId = 1;
  const pagesId = 2;
  const firstPageId = 3;
  const fontId = firstPageId + pages.length * 2; // after every page+content pair

  const offsets: number[] = [];
  let out = "%PDF-1.4\n";
  const addObject = (id: number, body: string) => {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${body}\nendobj\n`;
  };
  const addStream = (id: number, dict: string, stream: string) => {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${dict}\nstream\n${stream}\nendstream\nendobj\n`;
  };

  const pageIds = pages.map((_, i) => firstPageId + i * 2);
  const contentIds = pages.map((_, i) => firstPageId + i * 2 + 1);

  addObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  addObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  pages.forEach((page, i) => {
    const escaped = page.text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    addStream(contentIds[i], `<< /Length ${escaped.length + 30} >>`, `BT /F1 14 Tf 72 720 Td (${escaped}) Tj ET`);
    addObject(
      pageIds[i],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[i]} 0 R ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  });
  addObject(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = out.length;
  const size = fontId + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += xref;
  out += `trailer\n<< /Size ${size} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(out);
}

describe("parsePdf — the reader's pdf path (FR-8 groundwork)", () => {
  it("extracts one section per page with page-N ids", async () => {
    const bytes = buildPdf([
      { text: "Raft basics" },
      { text: "Log replication" },
    ]);

    const sections = await parsePdf(bytes, "zh");

    expect(sections.map((s) => s.id)).toEqual(["page-1", "page-2"]);
    expect(sections[0].text).toContain("Raft basics");
    expect(sections[1].text).toContain("Log replication");
  });

  it("uses a heading-like first line as the page title", async () => {
    const bytes = buildPdf([{ text: "Raft basics" }]);

    const sections = await parsePdf(bytes, "zh");

    expect(sections[0].title).toBe("Raft basics");
  });

  it("falls back to the honest bilingual page title when the page opens like prose", async () => {
    // Prose lines ending in a sentence mark (ASCII — standard-14 Helvetica has
    // no CJK glyphs) trigger the fallback; the LANGUAGE picks its wording.
    const prose = "Raft elects a leader, all writes flow through it.";

    const zh = await parsePdf(buildPdf([{ text: prose }]), "zh");
    const en = await parsePdf(buildPdf([{ text: prose }]), "en");

    expect(zh[0].title).toBe("第 1 页");
    expect(en[0].title).toBe("Page 1");
  });

  it("answers a zero-page document with [] (parseFile reports the empty reason)", async () => {
    const sections = await parsePdf(buildPdf([]), "en");
    expect(sections).toEqual([]);
  });
});

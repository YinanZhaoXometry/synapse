/**
 * PDF per-page text extraction (FR-8 groundwork). pdfjs-dist is dynamically
 * imported HERE ONLY — no other module may import it (AD-8). The legacy build
 * keeps Node/jsdom (vitest fake worker) and older browsers working. T1 only
 * extracts text (getTextContent) — no canvas render, no text layer. Standard-14
 * fonts fall back to built-in glyph maps, so text extraction needs no font
 * data (rendering in T2 will pass standardFontDataUrl).
 */
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { MaterialSection } from "@/domain/entities";
import type { UiLanguage } from "@/ai/types";

/** A heading-like line is short and does not end like a sentence. */
const SENTENCE_END = /[,.;:!?，。；：！？…—]$/;
const HEADING_MAX_CHARS = 80;

/**
 * Page title: the page's first non-empty line when it reads like a heading,
 * else the honest bilingual fallback 「第 N 页」/ "Page N".
 */
function pageTitle(pageText: string, pageNumber: number, language: UiLanguage): string {
  const first = pageText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (first && first.length <= HEADING_MAX_CHARS && !SENTENCE_END.test(first)) return first;
  return language === "en" ? `Page ${pageNumber}` : `第 ${pageNumber} 页`;
}

export async function parsePdf(bytes: Uint8Array, language: UiLanguage): Promise<MaterialSection[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node/jsdom gets a fake-worker default from pdfjs itself; browsers need a real URL.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // useWorkerFetch: false keeps asset fetching on the main thread, which the
  // fake-worker path (Node/jsdom tests) requires.
  const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  // The loading task owns the teardown (pdfjs 6: destroy lives here —
  // openPdfDocument's discipline): extraction releases the worker + doc bytes.
  try {
    const doc = await loadingTask.promise;

    const sections: MaterialSection[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if ("str" in item) {
          text += item.str;
          if (item.hasEOL) text += "\n";
        }
      }
      const trimmed = text.trim();
      sections.push({ id: `page-${n}`, title: pageTitle(trimmed, n, language), text: trimmed });
    }
    return sections; // a zero-page document yields [] — parseFile reports the empty reason
  } finally {
    void loadingTask.destroy();
  }
}

/**
 * PDF page rendering (FR-8) — the canvas half of the reader's PDF branch.
 * pdfjs-dist is dynamically imported HERE ONLY (AD-8); nothing outside
 * features/reader may touch it. The component seam above this module is
 * OpenedPdfDocument: open once (bytes in, page sizes out — layout without
 * pixels), then render/release individual pages into canvases as the reader's
 * lazy window decides (pager.renderWindow). Rendering is deliberately NOT
 * component-tested (jsdom has no canvas); the window math around it is.
 *
 * Standard-14 fonts: pdfjs's browser default (useSystemFonts) falls back to
 * system fonts for non-embedded text, so no standardFontDataUrl / font bytes
 * ship in Phase 1 — embedded-font documents (the lecture-PDF norm) render
 * exactly as authored.
 */
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocumentProxy = Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>;
type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy["getPage"]>>;
type PdfLoadingTask = ReturnType<PdfjsModule["getDocument"]>;

/** The module loads once per session; the worker URL is a browser-only concern. */
let modulePromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      // Node/jsdom (vitest) gets a fake-worker default from pdfjs itself; browsers need a real URL.
      if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    });
  }
  return modulePromise;
}

export interface PdfPageSize {
  width: number;
  height: number;
}

/** A cancellable render — the lazy window cancels far pages mid-render. */
export interface PdfRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface OpenedPdfDocument {
  numPages: number;
  /** Scale-1 page size per page number (1-based) — the layout's pixel budget. */
  pageSize(pageNumber: number): PdfPageSize | undefined;
  /** Render one page at cssWidth CSS pixels (× dpr backing store) into the canvas. */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number, dpr: number): Promise<PdfRenderTask>;
  destroy(): void;
}

/**
 * Open the document and measure every page's scale-1 viewport up front — page
 * containers get real heights before any canvas renders, so the continuous
 * scroll never reflows and deep links (?page=N) can scroll immediately.
 */
export async function openPdfDocument(bytes: Uint8Array): Promise<OpenedPdfDocument> {
  const pdfjs = await loadPdfjs();
  // useWorkerFetch: false keeps asset fetching on the main thread (parse-pdf's
  // fake-worker path requires it; harmless — and consistent — in the browser).
  // The loading task owns the document's teardown (pdfjs 6: destroy lives here).
  const loadingTask: PdfLoadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  const doc = await loadingTask.promise;

  const sizes = new Map<number, PdfPageSize>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    sizes.set(n, { width: viewport.width, height: viewport.height });
  }

  return {
    numPages: doc.numPages,
    pageSize: (pageNumber) => sizes.get(pageNumber),
    async renderPage(pageNumber, canvas, cssWidth, dpr) {
      const page: PdfPageProxy = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = (cssWidth / base.width) * dpr;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${Math.floor(base.height * (cssWidth / base.width))}px`;
      const task = page.render({ canvas, viewport });
      return {
        promise: task.promise.then(() => undefined),
        cancel: () => task.cancel(),
      };
    },
    destroy() {
      void loadingTask.destroy();
    },
  };
}

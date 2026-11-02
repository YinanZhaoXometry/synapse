/**
 * The PDF page flow (FR-8): a continuous vertical flow of fit-width canvases
 * inside its own scroll container. Pages lazily render near the viewport
 * (IntersectionObserver) and far pages release — canvas pixels clear while the
 * container keeps its measured height, so scroll never jumps (pager.ts owns
 * the window math). The most-visible page is the current one and reports to
 * the top-bar pager; ←/→ steps pages; a deep link (?page=N) scrolls to its
 * target and, with ?hl=1, flashes it once in the citation tint (AD-8).
 * Canvas rendering itself is not component-tested (jsdom has no canvas).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { clampPage, inRenderWindow, renderWindow, stepPage } from "./pager";
import { openPdfDocument, type OpenedPdfDocument } from "./pdf-render";

/** Pages rendered either side of the current one; farther pages hold layout only. */
const RENDER_RADIUS = 2;
/** Device pixels per CSS pixel — capped so a hi-dpi window cannot balloon memory. */
const MAX_DPR = 2;
/** How long the citation-tint flash stays visible (AD-8: brief, once). */
const FLASH_MS = 1400;

export interface PdfFlowHandle {
  /** Scroll the flow so a page tops the viewport (pager arrows, ←/→, anchors). */
  scrollToPage(page: number): void;
}

interface PdfPageFlowProps {
  /** The material's session blob (AD-4) — read fresh per open, never persisted. */
  blob: Blob;
  /** The ?page=N anchor (raw, unclamped); null starts at page 1. */
  initialPage: number | null;
  /** The transient ?hl=1 flag — flash the anchor target once (AD-8). */
  flashTarget: boolean;
  /** Most-visible-page reports for the top-bar pager. */
  onPageChange(page: number): void;
  /** The document's page count, once open — the pager's 共 M 页. */
  onTotalPages(total: number): void;
}

export const PdfPageFlow = forwardRef<PdfFlowHandle, PdfPageFlowProps>(function PdfPageFlow(
  { blob, initialPage, flashTarget, onPageChange, onTotalPages },
  ref,
) {
  const { t } = useLanguage();
  const [doc, setDoc] = useState<OpenedPdfDocument | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [columnWidth, setColumnWidth] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(() => (initialPage ? Math.max(1, Math.floor(initialPage)) : 1));
  const [flashPage, setFlashPage] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const ratiosRef = useRef(new Map<number, number>());
  const anchoredRef = useRef(false);

  // Open once per blob identity — the blob is converted to its own bytes copy
  // per open, so a re-mount never meets a pdfjs-detached buffer.
  useEffect(() => {
    let stale = false;
    let opened: OpenedPdfDocument | undefined;
    setDoc(null);
    setOpenFailed(false);
    anchoredRef.current = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const openedDoc = await openPdfDocument(bytes);
        opened = openedDoc;
        if (stale) openedDoc.destroy();
        else {
          setDoc(openedDoc);
          onTotalPages(openedDoc.numPages);
        }
      } catch {
        if (!stale) setOpenFailed(true); // parsed state lied (or bytes mutated) — say so honestly
      }
    })();
    return () => {
      stale = true;
      opened?.destroy();
    };
  }, [blob, onTotalPages]);

  // Reading-column width (fit-width pages): measured, so page containers get
  // exact sizes before any canvas renders.
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setColumnWidth(Math.floor(width));
    });
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  const reportCurrent = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange(page);
    },
    [onPageChange],
  );

  // Most-visible page (visibility-based tracking, UX spine "page follows
  // scroll"): the intersecting page with the largest ratio wins. The full
  // tracker selector (measured page rects) is T4's — this keeps the pager and
  // render window honest for T2.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !doc) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const ratios = ratiosRef.current;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting) ratios.set(page, entry.intersectionRatio);
          else if (ratios.get(page) !== undefined) ratios.delete(page);
        }
        let best = -1;
        let bestRatio = 0;
        for (const [page, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = page;
            bestRatio = ratio;
          }
        }
        if (best > 0) reportCurrent(best);
      },
      { root, threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
    );
    for (const element of pageRefs.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [doc, columnWidth, reportCurrent]);

  const scrollToPage = useCallback(
    (page: number) => {
      if (!doc) return;
      const target = clampPage(page, doc.numPages);
      pageRefs.current.get(target)?.scrollIntoView({ block: "start", behavior: "auto" });
      reportCurrent(target);
    },
    [doc, reportCurrent],
  );

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

  // Anchor landing (?page=N, AD-8): scroll once the layout is real (doc open +
  // column measured), then flash the target once when ?hl=1 rode along.
  useEffect(() => {
    if (anchoredRef.current || !doc || columnWidth === null) return;
    anchoredRef.current = true;
    if (initialPage !== null) {
      const target = clampPage(initialPage, doc.numPages);
      pageRefs.current.get(target)?.scrollIntoView({ block: "start", behavior: "auto" });
      reportCurrent(target);
      if (flashTarget) {
        setFlashPage(target);
        window.setTimeout(() => setFlashPage(null), FLASH_MS);
      }
    }
    // The anchor is consumed exactly once per mount; its parts are stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, columnWidth]);

  // ←/→ steps pages (UX interaction primitive) — ignored while typing.
  useEffect(() => {
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        scrollToPage(stepPage(currentPage, event.key === "ArrowLeft" ? -1 : 1, doc.numPages));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, currentPage, scrollToPage]);

  const renderWin = useMemo(
    () => (doc ? renderWindow(currentPage, doc.numPages, RENDER_RADIUS) : { from: 0, to: 0 }),
    [doc, currentPage],
  );

  if (openFailed) {
    return <StateCard title={t("reader.renderFailedTitle")} body={t("reader.renderFailedBody")} />;
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-secondary/50">
      <div ref={columnRef} className="mx-auto w-full max-w-[980px] px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
        {!doc || columnWidth === null
          ? null
          : Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => {
              const base = doc.pageSize(n);
              if (!base) return null;
              const width = columnWidth;
              const height = Math.floor((base.height / base.width) * width);
              return (
                <PdfPageCanvas
                  key={n}
                  doc={doc}
                  pageNumber={n}
                  width={width}
                  height={height}
                  shouldRender={inRenderWindow(n, renderWin)}
                  flash={flashPage === n}
                  containerRef={(el) => {
                    if (el) pageRefs.current.set(n, el);
                    else pageRefs.current.delete(n);
                  }}
                />
              );
            })}
      </div>
    </div>
  );
});

/**
 * One page container — the app's ONE large shadow lives here (DESIGN ·
 * Elevation: a page is a physical object). Pixels render only inside the lazy
 * window; release clears the canvas but keeps the measured height.
 */
interface PdfPageCanvasProps {
  doc: OpenedPdfDocument;
  pageNumber: number;
  width: number;
  height: number;
  shouldRender: boolean;
  flash: boolean;
  containerRef(el: HTMLDivElement | null): void;
}

function PdfPageCanvas({ doc, pageNumber, width, height, shouldRender, flash, containerRef }: PdfPageCanvasProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: { cancel(): void } | undefined;
    if (shouldRender) {
      (async () => {
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
          const pending = await doc.renderPage(pageNumber, canvas, width, dpr);
          if (cancelled) {
            pending.cancel();
            return;
          }
          task = pending;
          await pending.promise;
        } catch {
          // Cancelled renders reject by design (RenderingCancelledException) —
          // and a genuine render failure leaves the page honestly blank rather
          // than faking pixels.
        }
      })();
    } else {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, shouldRender]);

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      role="group"
      aria-label={t("reader.pageAria", { n: pageNumber })}
      className="relative mx-auto bg-card shadow-raised rounded-[4px] overflow-hidden"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="block" aria-hidden="true" />
      {/* Citation-tint flash (?hl=1, transient — AD-8); prefers-reduced-motion
          collapses it to an instant state change (index.css media rule). */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 bg-[hsl(var(--citation-tint))] animate-reader-flash" />
      )}
    </div>
  );
}

/** Honest centered card for render-level failures (parsed but unrenderable). */
function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-secondary/50 flex items-center justify-center p-6">
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{body}</p>
      </div>
    </div>
  );
}

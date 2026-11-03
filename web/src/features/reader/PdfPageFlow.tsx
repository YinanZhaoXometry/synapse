/**
 * The PDF page flow (FR-8): a continuous vertical flow of fit-width canvases
 * inside its own scroll container. Pages lazily render near the viewport and
 * far pages release — the canvas backing store is freed while the container
 * keeps its measured height, so scroll never jumps (pager.ts owns the window
 * math). The
 * most-visible page is the current one (FR-10): measured page rects + scrollTop
 * feed the pure selector in position-tracking.ts, and the result reports to the
 * top-bar pager and the position tracker; ←/→ steps pages; a deep link
 * (?page=N — or the stored-progress restore, same channel) scrolls to its
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
import { READER_FLASH_MS } from "./anchors";
import { clampPage, inRenderWindow, renderWindow, stepPage } from "./pager";
import { mostVisiblePage, type MeasuredPageRect } from "./position-tracking";
import { openPdfDocument, type OpenedPdfDocument } from "./pdf-render";

/** Pages rendered either side of the current one; farther pages hold layout only. */
const RENDER_RADIUS = 2;
/** Device pixels per CSS pixel — capped so a hi-dpi window cannot balloon memory. */
const MAX_DPR = 2;

export interface PdfFlowHandle {
  /**
   * Scroll the flow so a page tops the viewport (pager arrows, ←/→, anchors).
   * `flash` re-runs the citation-tint flash on the target — the in-reader half
   * of the AD-8 anchor channel (citation chips, T5); deep links keep using the
   * ?hl=1 mount flag.
   */
  scrollToPage(page: number, flash?: boolean): void;
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
  const anchoredRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);

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
  // scroll", FR-10): measured page rects + scrollTop feed the pure selector
  // (position-tracking.ts) — the exact half-visible boundary between two equal
  // pages flips the tracked page there. Page containers are all mounted (only
  // canvases are windowed), so the rects are complete; rAF throttles the
  // measurement to one pass per frame.
  const updateCurrentFromViewport = useCallback(() => {
    const root = scrollRef.current;
    if (!root || !doc) return;
    const rects: MeasuredPageRect[] = [];
    for (const [page, element] of pageRefs.current) {
      rects.push({ page, top: element.offsetTop, height: element.offsetHeight });
    }
    const page = mostVisiblePage(rects, root.scrollTop, root.clientHeight);
    if (page !== null) reportCurrent(page);
  }, [doc, reportCurrent]);

  // Scroll listening feeds the selector — component wiring only, no math here.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !doc) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateCurrentFromViewport();
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [doc, updateCurrentFromViewport]);

  // A citation-flash timer never outlives the flow.
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const scrollToPage = useCallback(
    (page: number, flash = false) => {
      if (!doc) return;
      const target = clampPage(page, doc.numPages);
      pageRefs.current.get(target)?.scrollIntoView({ block: "start", behavior: "auto" });
      reportCurrent(target);
      if (flash) {
        // Citation-chip flash (AD-8): one transient tint, a re-jump replaces
        // the pending clear instead of racing it.
        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
        setFlashPage(target);
        flashTimerRef.current = window.setTimeout(() => {
          flashTimerRef.current = null;
          setFlashPage(null);
        }, READER_FLASH_MS);
      }
    },
    [doc, reportCurrent],
  );

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

  // Anchor landing (?page=N or a stored-progress restore, AD-8): scroll once
  // the layout is real (doc open + column measured), then flash the target
  // once when ?hl=1 rode along. With no target the tracker still takes its
  // first reading (page 1 is the baseline).
  useEffect(() => {
    if (anchoredRef.current || !doc || columnWidth === null) return;
    anchoredRef.current = true;
    if (initialPage !== null) {
      const target = clampPage(initialPage, doc.numPages);
      pageRefs.current.get(target)?.scrollIntoView({ block: "start", behavior: "auto" });
      reportCurrent(target);
      if (flashTarget) {
        // Same tracked pattern as the citation flash — a landing flash timer
        // never outlives the flow either.
        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
        setFlashPage(target);
        flashTimerRef.current = window.setTimeout(() => {
          flashTimerRef.current = null;
          setFlashPage(null);
        }, READER_FLASH_MS);
      }
    } else {
      updateCurrentFromViewport();
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
    // `relative` makes the scroll container the pages' offsetParent, so their
    // offsetTop/offsetHeight are content coordinates (same contract as
    // MarkdownFlow's measured boundaries).
    <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto bg-secondary/50">
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
 * window; release frees the backing store but keeps the measured height.
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
      // Free the backing store too — clearRect alone keeps the bitmap
      // allocated (~MBs per far page over a long read). The container's
      // measured style height keeps layout stable; renderPage re-allocates
      // (it assigns width/height before drawing) on re-entry.
      canvas.width = 0;
      canvas.height = 0;
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

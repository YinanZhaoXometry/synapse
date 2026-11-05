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
 *
 * Mastery Marking (FR-15, epic-15 T3): presentational only — the mounter's
 * optional props drive a top-right corner control per page and the claimed
 * page's mastered band; the page element (`data-page`) stays the layout
 * truth and the marking never enters the text flow.
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
import { Bookmark, BookmarkCheck, ListChecks } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { READER_FLASH_MS } from "./anchors";
import {
  applyPdfPageAnnotations,
  clearPdfPageAnnotations,
  type AnnotationApplyResult,
  type AnnotationRenderItem,
} from "./annotation-engine";
import type { QuickTestGateState } from "./quick-test-gate";
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
  /**
   * The annotations to paint (FR-16, epic-13 T3 — render items, memoized by
   * the caller). Pages apply their own ranges post-text-layer-render;
   * results report up (deferred = the page is off the lazy render window).
   */
  annotations?: AnnotationRenderItem[];
  /** The engine's application results (the list panel's honesty badges). */
  onAnnotationsApplied?(results: AnnotationApplyResult[]): void;
  /**
   * Mastery Marking (FR-15, epic-15 T3) — presentational, like MarkdownView's
   * surface: the mounter's open-claim ids (PDF sections are `page-N`),
   * claim/unmark + confirm-quiz handlers (absent = feature off — the
   * SelectionBar optional-group pattern), and the confirm-quiz gate (the
   * selection bar's posture contract; defaults "ready").
   */
  claimedSectionIds?: Set<string>;
  onToggleClaim?(sectionId: string): void;
  onConfirmQuiz?(sectionId: string): void;
  quickTestGate?: QuickTestGateState;
}

export const PdfPageFlow = forwardRef<PdfFlowHandle, PdfPageFlowProps>(function PdfPageFlow(
  { blob, initialPage, flashTarget, onPageChange, onTotalPages, annotations, onAnnotationsApplied, claimedSectionIds, onToggleClaim, onConfirmQuiz, quickTestGate = "ready" },
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

  // The annotations grouped per page (stable per annotations change — the
  // pages' apply effects key on these, never on transient render arrays).
  const annotationsByPage = useMemo(() => {
    if (!annotations) return null;
    const map = new Map<number, AnnotationRenderItem[]>();
    for (const item of annotations) {
      const page = item.range.page;
      if (page === undefined) continue;
      const list = map.get(page) ?? [];
      list.push(item);
      map.set(page, list);
    }
    return map;
  }, [annotations]);

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
                  annotations={annotationsByPage?.get(n)}
                  onAnnotationsApplied={onAnnotationsApplied}
                  marking={
                    onToggleClaim
                      ? {
                          claimed: claimedSectionIds?.has(`page-${n}`) === true,
                          onToggleClaim,
                          onConfirmQuiz,
                          quickTestGate,
                        }
                      : undefined
                  }
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
  /** This page's annotation render items (stable — grouped by the flow). */
  annotations?: AnnotationRenderItem[];
  /** The engine's application results (aggregated up to the list panel). */
  onAnnotationsApplied?(results: AnnotationApplyResult[]): void;
  /** This page's marking wiring (undefined = feature off — no control, no band). */
  marking?: {
    claimed: boolean;
    onToggleClaim(sectionId: string): void;
    onConfirmQuiz?(sectionId: string): void;
    quickTestGate: QuickTestGateState;
  };
  containerRef(el: HTMLDivElement | null): void;
}

function PdfPageCanvas({ doc, pageNumber, width, height, shouldRender, flash, annotations, onAnnotationsApplied, marking, containerRef }: PdfPageCanvasProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The invisible selectable text layer (epic-13 T1, FR-13): the selection
  // surface the reader's selection bar captures on PDFs. Same lazy window as
  // the canvas — far pages hold layout only.
  const textLayerRef = useRef<HTMLDivElement>(null);
  // The layer's readiness gates the annotation pass (FR-16): the ranges are
  // text-anchored, so they apply the moment the spans exist — and re-apply
  // whenever the annotations change while the layer is up.
  const [layerReady, setLayerReady] = useState(false);

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

  // The text layer rides the same render window; a width change re-renders it
  // (the spans are percentage-positioned but the font math reads the scale
  // var renderTextLayer sets). Failures stay honest: no spans, no selection.
  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer) return;
    let cancelled = false;
    let task: { cancel(): void } | undefined;
    setLayerReady(false);
    if (shouldRender) {
      (async () => {
        try {
          const pending = await doc.renderTextLayer(pageNumber, layer, width);
          if (cancelled) {
            pending.cancel();
            return;
          }
          task = pending;
          await pending.promise;
          if (!cancelled) setLayerReady(true);
        } catch {
          // Cancelled (RenderingCancelledException) or failed — the page's
          // text is simply not selectable, never wrongly selectable.
        }
      })();
    } else {
      layer.replaceChildren();
    }
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, shouldRender]);

  // The annotation pass (FR-16, epic-13 T3): once the layer is real (and
  // again whenever the annotations change), the engine paints this page's
  // ranges onto the spans — the span fallback path, since jsdom and pdfjs
  // layers both ride it. Teardown clears the page's highlight registrations.
  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer || !layerReady) return;
    const results = applyPdfPageAnnotations(layer, annotations ?? [], { staleTitle: t("reader.annotationStale") });
    onAnnotationsApplied?.(results);
  }, [layerReady, annotations, onAnnotationsApplied, t]);

  // The page's annotation marks live in the layer — gone with the layer;
  // the shared highlight registrations leave explicitly.
  useEffect(
    () => () => {
      const layer = textLayerRef.current;
      if (layer) clearPdfPageAnnotations(layer);
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      role="group"
      aria-label={t("reader.pageAria", { n: pageNumber })}
      className={cn(
        "relative mx-auto bg-card shadow-raised rounded-[4px] overflow-hidden",
        marking && "group",
      )}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="block" aria-hidden="true" />
      <div ref={textLayerRef} className="pdf-text-layer" aria-hidden="true" />
      {/* Citation-tint flash (?hl=1, transient — AD-8); prefers-reduced-motion
          collapses it to an instant state change (index.css media rule). */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 bg-[hsl(var(--citation-tint))] animate-reader-flash" />
      )}
      {/* Mastery Marking (FR-15, epic-15 T3): a claimed page wears the
          mastered band across its top edge, plus the corner control —
          hover-revealed over the page, always visible while claimed, OUTSIDE
          the text flow (the text layer and canvas never move). */}
      {marking && marking.claimed && (
        <span
          aria-hidden="true"
          data-testid="marking-page-band"
          className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-mastered-tint"
        />
      )}
      {marking && <PageMarkingControls sectionId={`page-${pageNumber}`} marking={marking} />}
    </div>
  );
}

/**
 * The page's corner marking control (FR-15, epic-15 T3): top-right, over the
 * canvas — claim when unclaimed (hover/focus-revealed; the page div is the
 * hover group), the green badge + unmark + the gated confirm-quiz launcher
 * when claimed. Real buttons with bilingual accessible names (AD-9); the
 * gate postures are the selection bar's exact contract (loading/error
 * disable — error adds the tooltip — none hides, ready enables).
 */
function PageMarkingControls({
  sectionId,
  marking,
}: {
  sectionId: string;
  marking: { claimed: boolean; onToggleClaim(sectionId: string): void; onConfirmQuiz?(sectionId: string): void; quickTestGate: QuickTestGateState };
}) {
  const { t } = useLanguage();
  const { claimed, onToggleClaim, onConfirmQuiz, quickTestGate } = marking;
  const stateLabel = t(claimed ? "marking.unmark" : "marking.claim");
  const confirmHidden = quickTestGate === "none";
  const confirmBlocked = quickTestGate === "loading" || quickTestGate === "error";
  return (
    <span
      className={cn(
        "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-border-soft bg-[var(--glass-4)] p-0.5 shadow-raised transition-opacity",
        claimed
          ? "opacity-100"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto",
      )}
    >
      <button
        type="button"
        data-testid={claimed ? "marking-unmark" : "marking-claim"}
        aria-label={stateLabel}
        title={stateLabel}
        onClick={() => onToggleClaim(sectionId)}
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-[var(--glass-2)]",
          claimed ? "text-mastered-ink" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {claimed ? (
          <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Bookmark className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      {claimed && !confirmHidden && (
        <button
          type="button"
          data-testid="marking-confirm-quiz"
          aria-label={t("marking.confirmQuiz")}
          title={quickTestGate === "error" ? t("reader.quickTestUnavailable") : t("marking.confirmQuiz")}
          disabled={confirmBlocked}
          aria-disabled={confirmBlocked}
          onClick={() => onConfirmQuiz?.(sectionId)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-accent-ink cursor-pointer hover:bg-[var(--glass-2)] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ListChecks className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </span>
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

/**
 * The Markdown flow (FR-9): the same reader surface the PDF branch reads on —
 * its own scroll column, the app's centered reading measure (reader-body,
 * 70ch per DESIGN), deep-link + flash anchoring (#section-id / ?hl=1, AD-8),
 * and the section seam the position tracker (T4) consumes:
 * onHeadingsResolved reports the rendered section ids in document order;
 * measureBoundaries() measures each heading's offsetTop relative to the scroll
 * container (it is the headings' offsetParent — content coordinates, stable
 * under scroll); onViewportScroll reports raw scrollTops from real scroll
 * events (rAF-throttled) for the pure scroll-spy selector;
 * scrollToSection mirrors PdfFlowHandle.scrollToPage for
 * citation jumps (T5). react-markdown itself lives in markdown-view, which is
 * lazy-loaded here, so the markdown pipeline ships in its own chunk (AD-8,
 * same rule as pdfjs). Prose rendering is not component-tested beyond the
 * anchor-agreement seam (jsdom has no layout).
 */
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { READER_FLASH_MS } from "./anchors";

const MarkdownView = lazy(() => import("./markdown-view"));

/** One measured section boundary: a rendered heading id and its offsetTop. */
export interface MeasuredSection {
  id: string;
  /** Heading offsetTop — relative to the scroll container (its offsetParent). */
  top: number;
}

export interface MarkdownFlowHandle {
  /** Scroll a section heading to the top of the viewport (citation chips, T5). */
  scrollToSection(id: string): void;
  /** Measured section boundaries in document order (position tracker, T4). */
  measureBoundaries(): MeasuredSection[];
}

interface MarkdownFlowProps {
  /** The material's session blob (AD-4) — decoded to the FULL document text. */
  blob: Blob;
  /** The #section-id hash anchor (already hash-decoded); null starts at the top. */
  initialSection: string | null;
  /** The transient ?hl=1 flag — flash the anchor target once (AD-8). */
  flashTarget: boolean;
  /** The rendered section ids, in document order, once the document is in the DOM. */
  onHeadingsResolved?(ids: string[]): void;
  /**
   * Viewport scroll reports (position tracker, T4): scrollTop on scroll
   * (rAF-throttled) plus once after the anchor/restore landing settles. The
   * caller combines this with measureBoundaries() through the pure selector.
   */
  onViewportScroll?(scrollTop: number): void;
}

export const MarkdownFlow = forwardRef<MarkdownFlowHandle, MarkdownFlowProps>(function MarkdownFlow(
  { blob, initialSection, flashTarget, onHeadingsResolved, onViewportScroll },
  ref,
) {
  const [text, setText] = useState<string | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [flashSection, setFlashSection] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const anchoredRef = useRef(false);

  // Decode once per blob identity (AD-4): bytes → the full document text. The
  // parsed Material.sections stay the bounded extraction — that asymmetry is
  // by design; this render shows the document as authored.
  useEffect(() => {
    let stale = false;
    setText(null);
    setDecodeFailed(false);
    setResolved(false);
    anchoredRef.current = false;
    (async () => {
      try {
        const decoded = new TextDecoder("utf-8").decode(await blob.arrayBuffer());
        if (!stale) setText(decoded);
      } catch {
        if (!stale) setDecodeFailed(true); // parsed state lied (or bytes mutated) — say so honestly
      }
    })();
    return () => {
      stale = true;
    };
  }, [blob]);

  const handleResolved = useCallback(
    (ids: string[]) => {
      setResolved(true);
      onHeadingsResolved?.(ids);
    },
    [onHeadingsResolved],
  );

  // Anchor landing (#section-id, AD-8): scroll once the headings are real in
  // the DOM, then flash the target once when ?hl=1 rode along. A stale hash —
  // no such heading — honestly does nothing. No viewport report here: the
  // landing's own scroll event (and every user scroll after it) carries the
  // settled scrollTop to the position tracker.
  useEffect(() => {
    if (anchoredRef.current || !resolved) return;
    anchoredRef.current = true;
    if (initialSection === null) return;
    const target = document.getElementById(initialSection);
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "auto" });
    if (flashTarget) {
      setFlashSection(initialSection);
      window.setTimeout(() => setFlashSection(null), READER_FLASH_MS);
    }
    // The anchor is consumed exactly once per mount; its parts are stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  // Scroll reports for the position tracker (FR-10): raw scrollTop only — the
  // section selection is the pure selector's job (position-tracking.ts).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onViewportScroll) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        onViewportScroll(root.scrollTop);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [onViewportScroll]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  const measureBoundaries = useCallback((): MeasuredSection[] => {
    const headings = scrollRef.current?.querySelectorAll<HTMLElement>(
      "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]",
    );
    if (!headings) return [];
    return Array.from(headings, (el) => ({ id: el.getAttribute("id") ?? "", top: el.offsetTop }));
  }, []);

  useImperativeHandle(ref, () => ({ scrollToSection, measureBoundaries }), [scrollToSection, measureBoundaries]);

  if (decodeFailed) {
    return <StateCard title="reader.renderFailedTitle" body="reader.renderFailedBody" />;
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto relative bg-secondary/50">
      <div className="w-full px-4 md:px-8 py-6 md:py-8 flex justify-center">
        <article className="reader-body reader-prose w-full max-w-[70ch]">
          {text === null ? (
            <MarkdownSkeleton />
          ) : (
            <Suspense fallback={<MarkdownSkeleton />}>
              <MarkdownView text={text} flashSection={flashSection} onHeadingsResolved={handleResolved} />
            </Suspense>
          )}
        </article>
      </div>
    </div>
  );
});

/** Calm line-skeleton while the bytes decode / the markdown chunk loads. */
function MarkdownSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-7 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

/** Honest centered card for render-level failures (parsed but undecodable). */
function StateCard({ title, body }: { title: string; body: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-secondary/50 flex items-center justify-center p-6">
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <p className="text-sm font-semibold">{t(title)}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{t(body)}</p>
      </div>
    </div>
  );
}

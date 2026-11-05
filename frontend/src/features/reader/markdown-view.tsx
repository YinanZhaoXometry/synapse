/**
 * The Markdown render (FR-9): react-markdown + rehype-slug — the exact
 * packages the sectioner (parse-markdown.ts) mirrors, so the rendered heading
 * ids ARE the section anchors. This module is the ONLY place react-markdown is
 * imported, and MarkdownFlow lazy-loads it, keeping the markdown pipeline in a
 * reader-only chunk (AD-8, same rule as pdfjs). Headings carry a scroll margin
 * so deep links land with breathing room, and the flashing one (?hl=1, AD-8)
 * washes once in the citation tint under an overlay — the same mechanism the
 * PDF pages use. Prose typography is the reader-body role plus the
 * .reader-prose rules in index.css (semantic tokens only).
 *
 * Annotations (FR-16, epic-13 T3): after each commit the annotation engine
 * paints the render items onto this subtree (the wrapped-span fallback or
 * the CSS Custom Highlight API — annotation-engine.ts). The engine's marks
 * are imperative decorations OUTSIDE React's vdom, so ReactMarkdown is
 * keyed by the document text: a text change REMOUNTS the prose subtree
 * fresh, and React never diffs against an engine-mutated DOM. Sections are
 * the engine's address space (the heading-id regions); the intro contract
 * rides in exactly as selection-capture's capture does.
 *
 * Mastery Marking (FR-15, epic-15 T3): the component stays presentational —
 * the mounter's optional props (open-claim ids + claim/unmark + confirm-quiz
 * handlers, absent = feature off) drive a hover-revealed control at each
 * heading's right edge and the claimed section's green start (tint overlay +
 * mastered edge bar, the flash overlay's positioning precedent).
 */
import { useEffect, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import { Bookmark, BookmarkCheck, ListChecks } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  applyMarkdownAnnotations,
  clearMarkdownAnnotations,
  STALE_TITLE_KEY,
  type AnnotationApplyResult,
  type AnnotationRenderItem,
} from "./annotation-engine";
import type { QuickTestGateState } from "./quick-test-gate";

interface MarkdownViewProps {
  /** The FULL document text, decoded from the session bytes (AD-4). */
  text: string;
  /** The section id currently flashing — its heading washes once; null = none. */
  flashSection: string | null;
  /** The rendered heading ids, in document order, once they exist in the DOM. */
  onHeadingsResolved?(ids: string[]): void;
  /** The annotations to paint (render items; empty/undefined = none). */
  annotations?: AnnotationRenderItem[];
  /** The intro contract's id (the parsed intro section has no rendered heading). */
  introSectionId?: string | null;
  /** The resolved drift copy (the flow passes t("reader.annotationStale")). */
  staleTitle?: string;
  /** The engine's per-application results (the list panel's stale/missing honesty). */
  onAnnotationsApplied?(results: AnnotationApplyResult[]): void;
  /**
   * The Mastery Marking open-claim section ids (FR-15, epic-15 T3). The
   * mounter passes it ONLY once the claim read has landed — undefined means
   * the feature is off entirely (no affordance, no green): an in-flight read
   * renders no claim state, never a premature or fake one (honest-empty).
   */
  claimedSectionIds?: Set<string>;
  /**
   * Claim when the section is unclaimed, unmark when claimed. Absent (with
   * the ids) = the feature is off — the SelectionBar optional-group pattern.
   */
  onToggleClaim?(sectionId: string): void;
  /** Launch the confirm quiz on a claimed section (only rendered there). */
  onConfirmQuiz?(sectionId: string): void;
  /**
   * The confirm-quiz gate — the selection bar's exact posture contract
   * (epic-13 T2): "loading"/"error" disable the launch honestly (error adds
   * the tooltip), "none" hides it, "ready" enables. Defaults "ready" so a
   * mounter that omits it keeps the pre-gate posture.
   */
  quickTestGate?: QuickTestGateState;
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type HeadingProps = JSX.IntrinsicElements["h1"] & { node?: unknown };

/** The per-heading marking wiring, resolved per render (null = feature off). */
interface HeadingMarking {
  claimedSectionIds?: Set<string>;
  onToggleClaim?(sectionId: string): void;
  onConfirmQuiz?(sectionId: string): void;
  quickTestGate: QuickTestGateState;
}

function headingComponent(Tag: HeadingTag, flashSection: string | null, marking: HeadingMarking | null) {
  return function Heading({ node: _node, children, ...rest }: HeadingProps) {
    const flashing = typeof rest.id === "string" && rest.id === flashSection;
    const sectionId = typeof rest.id === "string" && rest.id !== "" ? rest.id : null;
    const markingOn = marking !== null && sectionId !== null && typeof marking.onToggleClaim === "function";
    const claimed = markingOn && marking!.claimedSectionIds?.has(sectionId!) === true;
    return (
      // `group` drives the hover-revealed marking controls; `isolate` (claimed
      // only) makes the heading a stacking context so the green overlays ride
      // at negative z INSIDE it — behind the text, above the page background.
      <Tag {...rest} className={cn("relative scroll-mt-8 group", claimed && "isolate")}>
        {children}
        {claimed && (
          <span
            aria-hidden="true"
            data-testid="marking-section-tint"
            className="pointer-events-none absolute -inset-x-3 -inset-y-1 -z-10 rounded-md bg-mastered-tint"
          />
        )}
        {claimed && (
          <span
            aria-hidden="true"
            data-testid="marking-section-edge"
            className="pointer-events-none absolute -left-3 -top-1 -bottom-1 -z-10 w-1 rounded-full bg-mastered"
          />
        )}
        {flashing && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 -inset-y-1 bg-[hsl(var(--citation-tint))] animate-reader-flash"
          />
        )}
        {markingOn && sectionId && (
          <SectionMarkingControls
            sectionId={sectionId}
            claimed={claimed}
            onToggleClaim={marking!.onToggleClaim}
            onConfirmQuiz={marking!.onConfirmQuiz}
            quickTestGate={marking!.quickTestGate}
          />
        )}
      </Tag>
    );
  };
}

/**
 * The heading's marking controls (FR-15, epic-15 T3): a compact group
 * anchored at the heading's right edge — hover-revealed (the heading is the
 * hover group) plus focus-within (the keyboard path, AD-9), ALWAYS visible
 * while claimed. Unclaimed renders the claim affordance; claimed renders the
 * green state (the tint overlays above) with unmark + the gated confirm-quiz
 * launcher. Real buttons, bilingual accessible names via t() — this
 * component mounts only when the marking props ride in, inside a
 * LanguageProvider everywhere the feature is on (the bare-MarkdownView
 * renderers — e.g. the anchor-agreement tests — never mount it).
 */
function SectionMarkingControls({
  sectionId,
  claimed,
  onToggleClaim,
  onConfirmQuiz,
  quickTestGate,
}: {
  sectionId: string;
  claimed: boolean;
  onToggleClaim?(sectionId: string): void;
  onConfirmQuiz?(sectionId: string): void;
  quickTestGate: QuickTestGateState;
}) {
  const { t } = useLanguage();
  const stateLabel = t(claimed ? "marking.unmark" : "marking.claim");
  const confirmHidden = quickTestGate === "none";
  const confirmBlocked = quickTestGate === "loading" || quickTestGate === "error";
  return (
    <span
      className={cn(
        "absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 rounded-lg border border-border-soft bg-[var(--glass-4)] p-0.5 shadow-raised transition-opacity",
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
        onClick={() => onToggleClaim?.(sectionId)}
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

export default function MarkdownView({
  text,
  flashSection,
  onHeadingsResolved,
  annotations,
  introSectionId,
  staleTitle,
  onAnnotationsApplied,
  claimedSectionIds,
  onToggleClaim,
  onConfirmQuiz,
  quickTestGate = "ready",
}: MarkdownViewProps) {
  const docRef = useRef<HTMLDivElement>(null);

  // Report the rendered anchors straight from the DOM — the most authoritative
  // statement of which section ids exist (and in what order). Fires per text
  // change; MarkdownFlow gates its one-shot anchor landing on the first call.
  useEffect(() => {
    const headings = docRef.current?.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]");
    if (!headings) return;
    onHeadingsResolved?.(Array.from(headings, (el) => el.getAttribute("id") ?? ""));
  }, [text, onHeadingsResolved]);

  // The annotation pass (FR-16): after every commit — the fresh list is the
  // truth (the engine clears + re-applies; ranges are text-anchored, so
  // re-walks are stable). Results feed the list panel's honesty badges.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const results = applyMarkdownAnnotations(doc, annotations ?? [], {
      introSectionId: introSectionId ?? null,
      staleTitle: staleTitle ?? STALE_TITLE_KEY,
    });
    onAnnotationsApplied?.(results);
  }, [text, flashSection, annotations, introSectionId, staleTitle, onAnnotationsApplied]);

  // The engine's marks must never outlive the view.
  useEffect(() => () => {
    const doc = docRef.current;
    if (doc) clearMarkdownAnnotations(doc);
  }, []);

  // The marking wiring rides the heading factory only when the mounter's
  // claim handler is present — absent = feature off (no controls, no green).
  const marking: HeadingMarking | null =
    onToggleClaim !== undefined
      ? { claimedSectionIds, onToggleClaim, onConfirmQuiz, quickTestGate }
      : null;

  const components: Components = {
    h1: headingComponent("h1", flashSection, marking),
    h2: headingComponent("h2", flashSection, marking),
    h3: headingComponent("h3", flashSection, marking),
    h4: headingComponent("h4", flashSection, marking),
    h5: headingComponent("h5", flashSection, marking),
    h6: headingComponent("h6", flashSection, marking),
  };

  return (
    <div ref={docRef} className="reader-prose">
      {/* Keyed by the document text: a text change remounts the prose
          subtree fresh, so React never diffs against the engine-mutated
          DOM (the marks are imperative decorations, not vdom). */}
      <ReactMarkdown key={text} rehypePlugins={[rehypeSlug]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

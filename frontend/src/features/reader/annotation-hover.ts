/**
 * The annotation hover bridge (FR-16 tail, epic-24 T2): pointer → annotation
 * id, for the hover-to-remove popover. The two engine paths need two
 * mechanisms and this module owns both, handing the view one anchor shape:
 *
 *  - wrapped-mark fallback (jsdom / no Highlight API): the marks ARE in the
 *    DOM — plain event delegation on `mark[data-annotation-id]`.
 *  - CSS Custom Highlight API (every real browser): nothing is painted in the
 *    DOM, so the caret position resolves through
 *    caretRangeFromPoint/caretPositionFromPoint and the engine's
 *    hitTestMarkdownAnnotation answers the covering id (stale/missing ranges
 *    never report — they paint nothing).
 *
 * rAF-throttled pointermove; hover only with no buttons pressed (a text
 * selection drag must not pop the popover mid-drag). Geometry is the
 * annotation's OWN, sticky per id from first contact (2026-11-10): the mark
 * rect (fallback) or the caret's line box (Highlight path) — never the live
 * pointer point, which chases the cursor and makes the remove button
 * unreachable. Not a React module — the view mounts it in an effect and
 * renders from the anchor callback.
 */
import {
  hitTestMarkdownAnnotation,
  hitTestPdfAnnotation,
  type AnnotationRenderItem,
} from "./annotation-engine";

/** Where the popover anchors: the annotation's id + viewport coords. */
export interface AnnotationHoverAnchor {
  id: string;
  /** Viewport coords the popover should sit at. */
  x: number;
  y: number;
}

export interface AnnotationHoverOptions {
  /** The fresh render items (the same list the engine painted). */
  items: readonly AnnotationRenderItem[];
  /**
   * The intro contract's id (the engine's intro region address) — the
   * markdown surface's concern; the pdf surface addresses by page instead.
   */
  introSectionId?: string | null;
  /**
   * Which surface the caret path hit-tests (the fallback marks path is
   * surface-blind — the marks delegate their own events): "markdown" (the
   * default — the article's section regions) or "pdf" (the page layers'
   * `[data-page]` addresses). Defaults to "markdown".
   */
  surface?: "markdown" | "pdf";
  /** Anchor updates; null = the pointer left every annotation. */
  onAnchor(anchor: AnnotationHoverAnchor | null): void;
}

type CaretPositionLike = { offsetNode: Node; offset: number };
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPositionLike | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** The caret at viewport coords as a (text node, offset) pair, or null.
 * Feature-detected both ways (Firefox: Position, Chromium/WebKit: Range). */
function caretTextNodeAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as CaretDocument;
  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);
    return position?.offsetNode ? { node: position.offsetNode, offset: position.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }
  return null;
}

/** Whether this document exposes EITHER caret API (jsdom exposes neither —
 * there the fallback delegation is the only path, which is what tests run). */
function hasCaretApi(): boolean {
  const doc = document as CaretDocument;
  return typeof doc.caretPositionFromPoint === "function" || typeof doc.caretRangeFromPoint === "function";
}

/** The first non-degenerate client rect of a range, or null (jsdom reports
 * zero boxes; exotic hosts may not expose the rects API at all). */
function firstRect(range: Range): DOMRect | null {
  const rects = typeof range.getClientRects === "function" ? range.getClientRects() : [];
  const rect = rects.length > 0 ? rects[0] : typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
  return rect && (rect.width > 0 || rect.height > 0) ? rect : null;
}

/** A stable viewport point for the annotation under the caret (2026-11-10):
 * the line box of the caret's own position (a one-character Range), the
 * whole text node's box as the fallback, and the pointer point only where no
 * real boxes exist (jsdom). The popover centers horizontally over that point
 * (capped at the popover's half-width) so it hangs over the text, not off it. */
function stablePoint(node: Node, offset: number, x: number, y: number): { x: number; y: number } {
  try {
    if (typeof document.createRange !== "function" || node.nodeType !== Node.TEXT_NODE) return { x, y };
    const text = node as Text;
    const length = (text.nodeValue ?? "").length;
    const caret = document.createRange();
    caret.setStart(text, Math.min(offset, length));
    caret.setEnd(text, Math.min(offset + 1, length));
    const line = firstRect(caret);
    if (line) return { x: line.left + Math.min(line.width / 2, 130), y: line.top };
    const whole = document.createRange();
    whole.selectNodeContents(text);
    const box = firstRect(whole);
    if (box) return { x: box.left + Math.min(box.width / 2, 130), y: box.top };
  } catch {
    // No Range support in this host — the pointer point remains.
  }
  return { x, y };
}

/**
 * Attach the bridge to the article. Returns the disposer (call on unmount /
 * whenever the items identity changes — the fresh list is the truth).
 */
export function attachAnnotationHover(article: HTMLElement, opts: AnnotationHoverOptions): () => void {
  let raf = 0;
  let lastKey = "";
  // The anchor parks at the annotation's own geometry from FIRST contact and
  // stays put while the same annotation answers (2026-11-10). Re-anchoring to
  // the live pointer made the popover chase the cursor — the remove button
  // kept sliding away and could never be clicked. A new id re-parks; null
  // clears.
  let sticky: AnnotationHoverAnchor | null = null;

  const report = (anchor: AnnotationHoverAnchor | null) => {
    const key = anchor ? `${anchor.id}:${Math.round(anchor.x)},${Math.round(anchor.y)}` : "";
    if (key === lastKey) return;
    lastKey = key;
    if (!anchor) sticky = null;
    opts.onAnchor(anchor);
  };

  /** Same id ⇒ the parked anchor; a new id parks at the fresh geometry. */
  const anchorFor = (id: string, point: { x: number; y: number }): AnnotationHoverAnchor => {
    if (sticky && sticky.id === id) return sticky;
    sticky = { id, x: point.x, y: point.y };
    return sticky;
  };

  const resolve = (x: number, y: number, target: EventTarget | null) => {
    // The popover itself never resolves: it sits INSIDE the article (so
    // moving onto it fires no leave), and without this guard the pointer
    // resting on it would dismiss → re-open → dismiss in a flicker loop
    // (target = the popover ⇒ "no annotation"). Skip = keep the last anchor.
    const popover = article.querySelector(":scope > [data-anno-popover]");
    if (popover && target instanceof Node && popover.contains(target)) return;
    // Fallback path first: a real mark in the DOM answers directly.
    const mark = target instanceof Element ? target.closest("mark[data-annotation-id]") : null;
    if (mark) {
      const id = mark.getAttribute("data-annotation-id") ?? "";
      if (id) {
        const rect = mark.getBoundingClientRect();
        report(anchorFor(id, { x: rect.left + Math.min(rect.width / 2, 130), y: rect.top }));
        return;
      }
    }
    // Highlight-API path: no DOM to delegate on — the caret decides, and the
    // anchor comes from the caret's own line box (stablePoint), never the
    // moving pointer.
    if (!hasCaretApi()) return;
    const caret = caretTextNodeAt(x, y);
    if (!caret) {
      report(null);
      return;
    }
    // The caret landed in the popover's own text — same flicker guard.
    if (popover && popover.contains(caret.node)) return;
    const id =
      opts.surface === "pdf"
        ? hitTestPdfAnnotation(article, opts.items, caret.node, caret.offset)
        : hitTestMarkdownAnnotation(article, opts.items, opts.introSectionId ?? null, caret.node, caret.offset);
    if (!id) {
      report(null);
      return;
    }
    report(anchorFor(id, stablePoint(caret.node, caret.offset, x, y)));
  };

  const scheduleResolve = (x: number, y: number, target: EventTarget | null) => {
    if (raf) return;
    // rAF-throttled where the host has it; synchronous fallback where it
    // doesn't (a bare jsdom without pretendToBeVisual) so the bridge works
    // everywhere the reader does.
    if (typeof window.requestAnimationFrame === "function") {
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        resolve(x, y, target);
      });
    } else {
      resolve(x, y, target);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    // Mid-selection drag — never pop mid-drag. `buttons` can be undefined on
    // synthetic/hostile events; only a REAL pressed state suppresses.
    const pressed = typeof event.buttons === "number" ? event.buttons !== 0 : false;
    if (pressed) return;
    scheduleResolve(event.clientX, event.clientY, event.target);
  };
  const onMouseMove = (event: MouseEvent) => {
    // jsdom (and any pointer-less host) never fires pointer events — the
    // mouse twin keeps the bridge alive there; real browsers fire both and
    // the rAF + lastKey dedup makes the double fire a no-op.
    const pressed = typeof event.buttons === "number" ? event.buttons !== 0 : false;
    if (pressed) return;
    scheduleResolve(event.clientX, event.clientY, event.target);
  };
  const onPointerLeave = () => report(null);

  article.addEventListener("pointermove", onPointerMove);
  article.addEventListener("mousemove", onMouseMove);
  article.addEventListener("pointerleave", onPointerLeave);
  article.addEventListener("mouseleave", onPointerLeave);
  return () => {
    article.removeEventListener("pointermove", onPointerMove);
    article.removeEventListener("mousemove", onMouseMove);
    article.removeEventListener("pointerleave", onPointerLeave);
    article.removeEventListener("mouseleave", onPointerLeave);
    if (raf) window.cancelAnimationFrame(raf);
  };
}

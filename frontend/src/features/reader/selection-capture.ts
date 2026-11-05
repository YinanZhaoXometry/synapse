/**
 * Selection capture (FR-13, epic-13 T1): the pure mapper from a DOM Selection
 * to the AD-2 locator shapes — ReadingLocator verbatim ({kind:"markdown",
 * sectionId} | {kind:"pdf", page}) plus the selected text. Pure so it is
 * densely unit-tested (jsdom has no real selection/layout — the flows only
 * mount the listeners and feed; all mapping lives here, the
 * position-tracking.ts pattern).
 *
 * Markdown: the selection's ANCHOR node walks up to the nearest rendered
 * heading id (the rehype-slug anchors — markdown-view.tsx); a selection that
 * spans two sections CLAMPS to the first (the anchor side — the reader asked
 * where they STARTED). Text above the first heading has no heading element
 * (T3's intro contract): it maps to the caller-provided introSectionId —
 * Material.sections[0]'s id when the first section has no rendered heading,
 * the same rule ReaderPage's scroll-spy already applies — or captures nothing.
 *
 * PDF: the anchor walks up to the nearest page container's data-page
 * (PdfPageFlow's page boxes; the text layer spans live inside them). A
 * non-numeric data-page captures nothing (honest null, never a guessed page).
 *
 * Suppression: collapsed and whitespace-only selections capture nothing —
 * the bar must not trigger on a click-through. Selections outside the reader
 * root capture nothing (the bar is the reader's, not the app's).
 *
 * barAnchor is the floating bar's clamp math (pure, tested): centered above
 * the selection, flipping below near the viewport top, never outside.
 */
/** The reader's captured selection: an AD-2 locator + the exact selected text. */
export type CapturedSelection =
  | { kind: "markdown"; sectionId: string; text: string }
  | { kind: "pdf"; page: number; text: string };

/**
 * Client-side bound for the text that rides the Ask grounding (epic-13 T1) —
 * mirrors the server's MAX_QUESTION_CHARS discipline on
 * CreateStreamTicketInput.selection, so the mint can never refuse a capture
 * the UI offered. The composer still shows the FULL quote (honest display);
 * this bounds the ticket payload.
 */
export const MAX_SELECTION_CHARS = 20_000;

export interface SelectionCaptureContext {
  /** The reader content root (the markdown article or the pdf column). */
  root: HTMLElement;
  /** sections[0]'s id for selections above the first heading (T3's intro
   * contract); null/omitted → such selections capture nothing. */
  introSectionId?: string | null;
}

/** The nearest section anchor for a node: an ancestor data-page → pdf page
 * (page containers hold their text-layer spans); an ancestor heading id →
 * markdown section; flat prose (the react-markdown shape — headings are
 * SIBLINGS of the paragraphs they open) → the nearest heading BEFORE the
 * anchor node in document order. Returns the locator PIECE (sectionId string
 * or page number) or null when no anchor exists (the intro region). */
function nearestAnchor(startNode: Node, root: HTMLElement): string | number | null {
  let el: HTMLElement | null =
    startNode.nodeType === Node.ELEMENT_NODE ? (startNode as HTMLElement) : startNode.parentElement;
  while (el && el !== root) {
    const pageAttr = el.getAttribute?.("data-page");
    if (pageAttr) {
      const page = Number.parseInt(pageAttr, 10);
      if (Number.isInteger(page) && page >= 1) return page;
      return null; // a malformed page container — honest null, never a guess
    }
    if (/^H[1-6]$/.test(el.tagName) && el.id) return el.id;
    el = el.parentElement;
  }
  let preceding: HTMLElement | null = null;
  for (const heading of root.querySelectorAll<HTMLElement>("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]")) {
    if (heading.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
      preceding = heading; // startNode follows this heading — keep the LAST one
    }
  }
  return preceding?.id ?? null;
}

/**
 * Map a live (or fixture) Selection to the captured shape, or null when it
 * should not trigger the bar (collapsed / whitespace-only / outside the
 * reader / unanchored). Cross-section and cross-page selections clamp to the
 * anchor side (the FIRST section/page — where the selection started).
 */
export function captureSelection(selection: Selection | null, context: SelectionCaptureContext): CapturedSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer;
  if (!context.root.contains(startNode)) return null;

  const anchor = nearestAnchor(startNode, context.root);
  if (typeof anchor === "number") return { kind: "pdf", page: anchor, text };
  if (typeof anchor === "string") return { kind: "markdown", sectionId: anchor, text };
  // no heading above the anchor — the intro region, when the caller knows its id
  if (context.introSectionId) return { kind: "markdown", sectionId: context.introSectionId, text };
  return null;
}

export interface SelectionRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BarPosition {
  x: number;
  y: number;
}

/** The floating bar's viewport position: centered above the selection's
 * bounding rect; a selection near the top flips the bar BELOW the selection;
 * both axes clamp inside the viewport (8px gutters) so the bar is always
 * fully reachable. */
export function barAnchor(
  rect: SelectionRect,
  viewportWidth: number,
  viewportHeight: number,
  barWidth: number,
  barHeight: number,
): BarPosition {
  const gutter = 8;
  const flipBelow = rect.top < barHeight + gutter + gutter;
  const y = flipBelow ? rect.bottom + gutter : rect.top - barHeight - gutter;
  const clampedY = Math.min(Math.max(y, gutter), Math.max(viewportHeight - barHeight - gutter, gutter));
  const x = (rect.left + rect.right) / 2 - barWidth / 2;
  const clampedX = Math.min(Math.max(x, gutter), Math.max(viewportWidth - barWidth - gutter, gutter));
  return { x: clampedX, y: clampedY };
}

/**
 * The AD-2 annotation range (FR-16, epic-13 T3 — ONE definition end to
 * end): where an annotation sits within an anchor text — the markdown
 * section's stable text or the pdf page's text-layer string — as char
 * offsets plus the quoted span for drift verification. The delta-2 law:
 * offsets are TEXT-anchored, never DOM-anchored, so they survive
 * re-render; the quote verifies them on every application (a drifted
 * anchor reads stale honestly — never silently misplaced).
 *
 * Pure domain (AD-2 — no React, no lib.dom: the mastery-vector generator's
 * node project compiles this file too, so the DOM surfaces enter as
 * STRUCTURAL handles the engine satisfies with real nodes — the same
 * posture mastery.ts/streak.ts keep). The builders take the engine's walk
 * products (a text-node list = the anchor's stable text) and a structural
 * view of a DOM Range, so jsdom tests run the exact math the browser runs.
 * The validator mirrors the server command law
 * (Annotations::AddAnnotationCommand — sectionId xor page agreeing with
 * the anchor kind, int offsets ≥ 0, end ≥ start, non-blank quote); the
 * staleness check is the render-time honesty rule.
 */

/** The AD-2 range shape — TS keys verbatim on the wire (delta 3). */
export interface AnnotationRange {
  /** The markdown section's stable id (markdown annotations; xor page). */
  sectionId?: string;
  /** The 1-based pdf page (pdf annotations; xor sectionId). */
  page?: number;
  /** The range's first character offset within the anchor text (inclusive, ≥ 0). */
  start: number;
  /** The range's end offset within the anchor text (exclusive, ≥ start). */
  end: number;
  /** The anchor text's [start, end) verbatim — the drift-verification span. */
  quote: string;
}

/** Which anchor a range addresses — the locator pieces (T1's capture). */
export interface RangeAnchor {
  sectionId?: string;
  page?: number;
}

/** Structural node handle (a DOM Text/Node satisfies it structurally —
 * the domain carries no lib.dom; the mastery-vector generator's node
 * project compiles this file's imports too). */
export interface AnnotationNode {
  readonly nodeType: number;
  readonly nodeValue: string | null;
  readonly childNodes: ArrayLike<AnnotationNode>;
  compareDocumentPosition(other: AnnotationNode): number;
}

/**
 * The structural view of a DOM Range the builders consume (a real Range
 * satisfies it; tests hand-build it). Element-based endpoints — a
 * selection starting between blocks — are resolved against the region's
 * node list.
 */
export interface RangeEndpoints {
  startContainer: AnnotationNode;
  startOffset: number;
  endContainer: AnnotationNode;
  endOffset: number;
  collapsed: boolean;
}

/** The DOM constants the resolution math reads (lib.dom values, local — the
 * domain carries no DOM lib). */
const TEXT_NODE_TYPE = 3;
const DOCUMENT_POSITION_FOLLOWING = 4;
const DOCUMENT_POSITION_PRECEDING = 2;

/** The anchor region's stable text: the engine's walked text nodes joined. */
export function textOfNodes(nodes: readonly AnnotationNode[]): string {
  let out = "";
  for (const node of nodes) out += node.nodeValue ?? "";
  return out;
}

/** Per-node [start, end) spans within the accumulated text. */
interface NodeSpan {
  node: AnnotationNode;
  start: number;
  text: string;
}

function spansOf(nodes: readonly AnnotationNode[]): { spans: NodeSpan[]; total: number } {
  const spans: NodeSpan[] = [];
  let offset = 0;
  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    spans.push({ node, start: offset, text });
    offset += text.length;
  }
  return { spans, total: offset };
}

/** The first text node in the region that follows `node` in document order. */
function firstNodeAfter(node: AnnotationNode, spans: readonly NodeSpan[]): NodeSpan | null {
  for (const span of spans) {
    if (span.node === node) continue;
    const position = node.compareDocumentPosition(span.node);
    if (position & DOCUMENT_POSITION_FOLLOWING) return span;
  }
  return null;
}

/** Whether `node` precedes the region's last text node (the outside-container
 * side test — the honest clamp's direction read). */
function precedesRegion(node: AnnotationNode, spans: readonly NodeSpan[]): boolean {
  const last = spans[spans.length - 1];
  if (!last) return false;
  return (node.compareDocumentPosition(last.node) & DOCUMENT_POSITION_PRECEDING) !== 0;
}

/**
 * Resolve one range endpoint to an offset within the accumulated text.
 * Text containers resolve directly (span start + in-node offset); element
 * containers resolve to the child at the offset, or — at/past the region —
 * to the nearest region node after it. A container outside the region
 * resolves by its side: before the region → null (the selection is not
 * anchored here), after the region → the region's end (the honest clamp —
 * T1 already pinned the anchor side; the range covers the anchor-side
 * portion).
 */
function resolveEndpoint(container: AnnotationNode, offset: number, spans: readonly NodeSpan[], total: number): number | null {
  const byNode = new Map<AnnotationNode, NodeSpan>();
  for (const span of spans) byNode.set(span.node, span);

  if (container.nodeType === TEXT_NODE_TYPE) {
    const span = byNode.get(container);
    if (span) {
      const local = Math.min(offset, span.text.length);
      return span.start + local;
    }
    return sideOfOutsideNode(container, spans, total);
  }

  // Element container: the child at the offset (or just past the region).
  const child = container.childNodes[offset] ?? null;
  if (child) {
    const direct = child.nodeType === TEXT_NODE_TYPE ? byNode.get(child) : undefined;
    if (direct) return direct.start;
    const following = firstNodeAfter(child, spans);
    if (following) return following.start;
    return sideOfOutsideNode(child, spans, total);
  }
  // Offset past the last child — the position at the element's end.
  const following = firstNodeAfter(container, spans);
  if (following) return following.start;
  return sideOfOutsideNode(container, spans, total);
}

function sideOfOutsideNode(node: AnnotationNode, spans: readonly NodeSpan[], total: number): number | null {
  const first = spans[0];
  if (!first) return null;
  if (node.compareDocumentPosition(first.node) & DOCUMENT_POSITION_FOLLOWING) return 0; // before the region
  if (precedesRegion(node, spans)) return total; // after the region
  return null; // inside the region but not on a walked text node (e.g. a br) — not addressable
}

/**
 * Build the annotation range from a live (or fixture) selection over the
 * anchor's walked text nodes. The quote IS the accumulated text's
 * [start, end) slice — drift-consistent by construction; a selection that
 * covers nothing in the region (collapsed, whitespace-only, entirely
 * outside) builds nothing (null), the captureSelection posture.
 */
export function rangeFromSelection(
  selection: RangeEndpoints,
  textNodes: readonly AnnotationNode[],
  anchor: RangeAnchor,
): AnnotationRange | null {
  if (!selection || selection.collapsed || textNodes.length === 0) return null;

  const { spans, total } = spansOf(textNodes);
  const start = resolveEndpoint(selection.startContainer, selection.startOffset, spans, total);
  if (start === null) return null;
  const rawEnd = resolveEndpoint(selection.endContainer, selection.endOffset, spans, total);
  if (rawEnd === null) return null;

  const end = Math.min(Math.max(rawEnd, start), total);
  if (end <= start) return null;

  const quote = textOfNodes(textNodes).slice(start, end);
  if (quote.trim().length === 0) return null; // the whitespace suppression, T1's rule

  const range: AnnotationRange = { start, end, quote };
  if (anchor.sectionId !== undefined) range.sectionId = anchor.sectionId;
  if (anchor.page !== undefined) range.page = anchor.page;
  return range;
}

/**
 * The shape law (the server command law mirrored — delta 3): exactly one
 * address (a non-blank sectionId XOR a positive integer page), integer
 * offsets ≥ 0 with end ≥ start, a non-blank quote. Rendering refuses to
 * apply an invalid row — the honest floor, not a silent skip.
 */
export function isValidAnnotationRange(range: unknown): boolean {
  if (typeof range !== "object" || range === null) return false;
  const candidate = range as Partial<AnnotationRange>;

  const hasSection = typeof candidate.sectionId === "string" && candidate.sectionId.length > 0;
  const hasPage = typeof candidate.page === "number" && Number.isInteger(candidate.page) && candidate.page >= 1;
  if (hasSection === hasPage) return false; // xor — both or neither is invalid

  const { start, end, quote } = candidate;
  if (typeof start !== "number" || !Number.isInteger(start) || start < 0) return false;
  if (typeof end !== "number" || !Number.isInteger(end) || end < start) return false;
  if (typeof quote !== "string" || quote.trim().length === 0) return false;
  return true;
}

/**
 * The drift check: does the anchor text STILL read the quote at
 * [start, end)? False (fresh) only when the slice matches verbatim; any
 * drift — edited text, moved offsets, a shorter document — reads stale,
 * and the engine renders that honestly (muted + 原文已变化), never
 * misplaced.
 */
export function isStaleRange(range: AnnotationRange, text: string): boolean {
  if (range.end > text.length) return true;
  return text.slice(range.start, range.end) !== range.quote;
}

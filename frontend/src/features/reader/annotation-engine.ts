/**
 * The annotation render engine (FR-16, epic-13 T3): applies the AD-2
 * domain ranges (domain/annotation-range.ts — the ONE definition) to the
 * reader surfaces. Markdown: a section's DOM region — the content after
 * its heading (or the intro region before the first heading) — walked into
 * text nodes; PDF: the T1 text layer's spans walked the same way. The two
 * surfaces differ ONLY in how the region resolves; the application math is
 * shared.
 *
 * ENGINE DECISION (the delta-grill's zero-dep char-offset choice, recorded
 * per the ticket AC): rendering rides the **CSS Custom Highlight API where
 * available** (zero DOM mutation — static Range objects registered per
 * color+kind in CSS.highlights; re-render-proof because the offsets are
 * text-anchored), with a **wrapped-<mark> fallback** (feature-detected —
 * jsdom and older browsers) that splits text nodes and wraps covered
 * slices. Criteria: fidelity (both paths paint exactly text.slice(start,
 * end) — verified by the shared tests) + bundle (zero new dependencies —
 * an annotation library would have bought nothing the text layer doesn't
 * already give). Fallback: mark[data-annotation-id] + anno-hl/anno-ul +
 * anno-color-* classes; clearing unwraps.
 *
 * Stale honesty (delta 2's law): on EVERY application the quote is
 * verified against the anchor text (isStaleRange). A drifted range never
 * paints at guessed offsets — the span path renders it muted with the
 * 「原文已变化」 title; the Highlight path leaves it unpainted; both report
 * status "stale" so the annotations list carries the same badge (AD-9's
 * honesty over color: the list is the textual channel).
 *
 * Statuses: "ok" (painted) · "stale" (drift — honest muted/unpainted) ·
 * "missing" (the section id is not in the DOM / the address is invalid) ·
 * "deferred" (a pdf page whose layer has not rendered — off the lazy
 * window; NOT an error, re-applied when the layer renders).
 */
import { isStaleRange, isValidAnnotationRange, rangeFromSelection, textOfNodes, type AnnotationRange } from "@/domain/annotation-range";
import type { CapturedSelection } from "./selection-capture";

/** The named palette keys (the chips; mirrored server-side in Annotations::NAMED_COLORS). */
export const ANNOTATION_COLORS = ["coral", "amber", "emerald", "blue"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];
export type AnnotationKind = "highlight" | "underline";

/** One annotation the engine renders (the mapped view's render slice). */
export interface AnnotationRenderItem {
  id: string;
  range: AnnotationRange;
  kind: AnnotationKind;
  color: AnnotationColor | null;
  body: string;
}

export type AnnotationApplyStatus = "ok" | "stale" | "missing" | "deferred";
export interface AnnotationApplyResult {
  id: string;
  status: AnnotationApplyStatus;
}

/** CSS Custom Highlight API feature detection — the registration path's gate. */
export function supportsHighlightApi(): boolean {
  return typeof Highlight !== "undefined" && typeof CSS !== "undefined" && CSS.highlights != null;
}

/** The registry key for one color+kind group (the ::highlight() rules in index.css). */
function highlightName(kind: AnnotationKind, color: AnnotationColor | null): string {
  return `synapse-anno-${kind}-${color ?? "default"}`;
}

/**
 * Per-root highlight groups — the reader-scoped ownership model. CSS.highlights
 * is a GLOBAL name→Highlight map, and a reader spans MANY roots (the markdown
 * article, every rendered pdf page layer): one page's re-application must not
 * drop another page's ranges. So each application REPLACES its own root's
 * groups and the shared registry is rebuilt from ALL live roots (cleared
 * roots drop out; the flows clear on unmount/teardown, so the store stays
 * bounded).
 */
const highlightStore = new Map<HTMLElement, Map<string, Range[]>>();

/** Rebuild the global registry from every live root's groups. */
function refreshHighlightRegistry(): void {
  const registry = (CSS as { highlights?: Map<string, unknown> }).highlights;
  if (!registry) return;
  const names = new Set<string>();
  for (const groups of highlightStore.values()) {
    for (const name of groups.keys()) names.add(name);
  }
  for (const name of names) {
    const ranges: Range[] = [];
    for (const groups of highlightStore.values()) {
      const groupRanges = groups.get(name);
      if (groupRanges) ranges.push(...groupRanges);
    }
    registry.set(name, new Highlight(...ranges));
  }
  // Names no longer owned by any root leave the registry.
  for (const name of Array.from(registry.keys())) {
    if (name.startsWith("synapse-anno-") && !names.has(name)) registry.delete(name);
  }
}

/** The per-application groups: color+kind → the built DOM Ranges. */
type HighlightGroup = { name: string; ranges: Range[] };

// ── region walks ─────────────────────────────────────────────────────────

const HEADING_SELECTOR = "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]";

/** The section's content region (the heading is the ADDRESS, not the
 * content — the walk starts AFTER it): the siblings following the heading
 * with the given id until the next heading. Flat prose is the
 * react-markdown shape (selection-capture.ts's rule). Unknown id → null
 * ("missing"), unless it is the intro contract's id — the parsed intro
 * section has no rendered heading — in which case the region is the nodes
 * BEFORE the first heading. */
function markdownSectionElements(container: HTMLElement, sectionId: string, introSectionId: string | null): Element[] | null {
  const headings = container.querySelectorAll<HTMLElement>(HEADING_SELECTOR);
  const heading = Array.from(headings).find((el) => el.id === sectionId);
  if (heading) {
    const region: Element[] = [];
    let node: Element | null = heading.nextElementSibling;
    while (node && !/^[Hh][1-6]$/.test(node.tagName) ) {
      region.push(node);
      node = node.nextElementSibling;
    }
    return region;
  }
  if (sectionId === introSectionId) {
    const region: Element[] = [];
    for (const child of Array.from(container.children)) {
      if (/^[Hh][1-6]$/.test(child.tagName) && (child as HTMLElement).id) break;
      region.push(child);
    }
    return region.length > 0 ? region : null;
  }
  return null;
}

/** Walk the elements' text nodes in document order (the anchor's stable text). */
function collectTextNodes(elements: readonly Element[]): Text[] {
  const nodes: Text[] = [];
  for (const element of elements) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      nodes.push(current as Text);
      current = walker.nextNode();
    }
  }
  return nodes;
}

/**
 * Apply the markdown annotations to the article element. Idempotent: the
 * previous application's marks/highlights are cleared first (the fresh
 * list is the truth). `introSectionId` is the T3 intro contract — the
 * parsed intro section's id (it has no rendered heading).
 */
export function applyMarkdownAnnotations(
  article: HTMLElement,
  items: readonly AnnotationRenderItem[],
  opts: { introSectionId?: string | null; staleTitle?: string } = {},
): AnnotationApplyResult[] {
  clearMarkdownAnnotations(article);
  const useHighlightApi = supportsHighlightApi();
  const staleTitle = opts.staleTitle ?? STALE_TITLE_KEY;
  const groups = new Map<string, HighlightGroup>();
  const results: AnnotationApplyResult[] = [];

  // Group by address once — the walk runs once per section.
  const bySection = new Map<string, AnnotationRenderItem[]>();
  for (const item of items) {
    if (!isValidAnnotationRange(item.range) || item.range.sectionId === undefined) {
      results.push({ id: item.id, status: "missing" }); // no markdown address to paint
      continue;
    }
    const list = bySection.get(item.range.sectionId) ?? [];
    list.push(item);
    bySection.set(item.range.sectionId, list);
  }

  for (const [sectionId, sectionItems] of bySection) {
    const elements = markdownSectionElements(article, sectionId, opts.introSectionId ?? null);
    if (!elements) {
      for (const item of sectionItems) results.push({ id: item.id, status: "missing" });
      continue;
    }
    const nodes = collectTextNodes(elements);
    const text = textOfNodes(nodes);
    for (const item of sectionItems) {
      results.push(applyItem(item, nodes, text, useHighlightApi, groups, staleTitle));
    }
  }

  registerHighlightGroups(article, groups);
  return results;
}

/** Clear the markdown application: unwrap marks + drop the root's highlights. */
export function clearMarkdownAnnotations(article: HTMLElement): void {
  unwrapMarks(article);
  dropRootHighlights(article);
}

/**
 * Apply ONE page's annotations to its rendered text layer. Called by the
 * page after renderTextLayer resolves (and on annotation changes). An
 * empty layer (off the render window) defers honestly.
 */
export function applyPdfPageAnnotations(
  layer: HTMLElement,
  items: readonly AnnotationRenderItem[],
  opts: { staleTitle?: string } = {},
): AnnotationApplyResult[] {
  clearPdfPageAnnotations(layer);
  const useHighlightApi = supportsHighlightApi();
  const staleTitle = opts.staleTitle ?? STALE_TITLE_KEY;
  const groups = new Map<string, HighlightGroup>();
  const results: AnnotationApplyResult[] = [];

  const nodes = collectTextNodes([layer]);
  if (nodes.length === 0) {
    // The layer renders lazily (the pdf render window) — not a failure;
    // the page re-applies when its layer comes up.
    return items.map((item) => ({ id: item.id, status: "deferred" as const }));
  }
  const text = textOfNodes(nodes);
  for (const item of items) {
    if (!isValidAnnotationRange(item.range) || item.range.page === undefined) {
      results.push({ id: item.id, status: "missing" });
      continue;
    }
    results.push(applyItem(item, nodes, text, useHighlightApi, groups, staleTitle));
  }

  registerHighlightGroups(layer, groups);
  return results;
}

/** Clear one page's application (marks vanish with the layer's re-render;
 * the page's highlight ranges leave the shared registry explicitly). */
export function clearPdfPageAnnotations(layer: HTMLElement): void {
  unwrapMarks(layer);
  dropRootHighlights(layer);
}

// ── shared application ───────────────────────────────────────────────────

/**
 * Build the annotation range for a captured selection (FR-16, the bar →
 * mutation seam): resolve the anchor region the T1 capture named (the
 * markdown section region / the pdf page's text layer) and map the LIVE
 * DOM Range onto its accumulated text. The quote derives from the slice —
 * drift-consistent by construction — and a selection that covers nothing
 * in the region builds nothing (null; the captureSelection posture).
 */
export function buildRangeFromCapture(
  root: HTMLElement,
  domRange: Range,
  captured: CapturedSelection,
  introSectionId: string | null,
): AnnotationRange | null {
  if (captured.kind === "markdown") {
    const elements = markdownSectionElements(root, captured.sectionId, introSectionId);
    if (!elements || elements.length === 0) return null;
    return rangeFromSelection(domRange, collectTextNodes(elements), { sectionId: captured.sectionId });
  }
  const layer = root.querySelector(`[data-page="${captured.page}"] .pdf-text-layer`);
  if (!layer) return null;
  return rangeFromSelection(domRange, collectTextNodes([layer]), { page: captured.page });
}

function applyItem(
  item: AnnotationRenderItem,
  nodes: readonly Text[],
  text: string,
  useHighlightApi: boolean,
  groups: Map<string, HighlightGroup>,
  staleTitle: string,
): AnnotationApplyResult {
  const { range } = item;
  if (isStaleRange(range, text)) {
    if (!useHighlightApi) wrapStale(item, nodes, staleTitle);
    return { id: item.id, status: "stale" };
  }
  if (useHighlightApi) {
    const ranges = buildDomRanges(range, nodes);
    if (ranges.length === 0) return { id: item.id, status: "stale" };
    const name = highlightName(item.kind, item.color);
    const group = groups.get(name) ?? { name, ranges: [] };
    group.ranges.push(...ranges);
    groups.set(name, group);
  } else {
    wrapFresh(item, nodes);
  }
  return { id: item.id, status: "ok" };
}

/** The covered per-node slices of a range: [node, localStart, localEnd). */
interface NodeSlice {
  node: Text;
  start: number;
  end: number;
}

function slicesOf(range: AnnotationRange, nodes: readonly Text[]): NodeSlice[] {
  const slices: NodeSlice[] = [];
  let offset = 0;
  for (const node of nodes) {
    const len = (node.nodeValue ?? "").length;
    const nodeStart = offset;
    offset += len;
    if (offset <= range.start || nodeStart >= range.end) continue;
    slices.push({
      node,
      start: Math.max(range.start - nodeStart, 0),
      end: Math.min(range.end - nodeStart, len),
    });
  }
  return slices;
}

/** The Highlight API path: static Ranges over the walked text nodes. */
function buildDomRanges(range: AnnotationRange, nodes: readonly Text[]): Range[] {
  return slicesOf(range, nodes).map(({ node, start, end }) => {
    const domRange = document.createRange();
    domRange.setStart(node, start);
    domRange.setEnd(node, end);
    return domRange;
  });
}

/** The fallback path: split text nodes, wrap covered slices in marks. */
function wrapFresh(item: AnnotationRenderItem, nodes: readonly Text[]): void {
  const marks = slicesOf(item.range, nodes).map(({ node, start, end }) => {
    let covered: Text = node;
    if (start > 0) covered = node.splitText(start);
    if (end - start < covered.nodeValue!.length) covered.splitText(end - start);
    return covered;
  });
  for (const covered of marks) {
    const mark = document.createElement("mark");
    mark.className = markClasses(item);
    mark.setAttribute("data-annotation-id", item.id);
    if (item.body) mark.title = item.body;
    covered.parentNode?.insertBefore(mark, covered);
    mark.appendChild(covered);
  }
}

/** The fallback path for a drifted range: muted + the honest drift title. */
function wrapStale(item: AnnotationRenderItem, nodes: readonly Text[], staleTitle: string): void {
  const marks = slicesOf(item.range, nodes).map(({ node, start, end }) => {
    let covered: Text = node;
    if (start > 0) covered = node.splitText(start);
    if (end - start < covered.nodeValue!.length) covered.splitText(end - start);
    return covered;
  });
  for (const covered of marks) {
    const mark = document.createElement("mark");
    mark.className = "anno-mark anno-stale";
    mark.setAttribute("data-annotation-id", item.id);
    mark.title = staleTitle;
    covered.parentNode?.insertBefore(mark, covered);
    mark.appendChild(covered);
  }
}

/** The honest drift marker — the default is the i18n KEY; flows pass the
 * resolved copy (the engine stays language-neutral, AD-9). */
export const STALE_TITLE_KEY = "reader.annotationStale";

function markClasses(item: AnnotationRenderItem): string {
  const kindClass = item.kind === "underline" ? "anno-ul" : "anno-hl";
  const colorClass = item.color ? `anno-color-${item.color}` : "anno-color-default";
  return `anno-mark ${kindClass} ${colorClass}`;
}

/** Replace this root's groups in the store, then rebuild the shared
 * registry (the Highlight constructor — always available when groups
 * exist, since they only get built on the feature-detected path). */
function registerHighlightGroups(root: HTMLElement, groups: Map<string, HighlightGroup>): void {
  const store = new Map<string, Range[]>();
  for (const { name, ranges } of groups.values()) store.set(name, ranges);
  if (store.size === 0) highlightStore.delete(root);
  else highlightStore.set(root, store);
  refreshHighlightRegistry();
}

/** Drop one root's groups and rebuild the shared registry. */
function dropRootHighlights(root: HTMLElement): void {
  if (!highlightStore.has(root)) return;
  highlightStore.delete(root);
  refreshHighlightRegistry();
}

/** Unwrap the engine's marks, restoring the plain text (no text lost —
 * split text nodes rejoin under the original parent; normalize rejoins
 * adjacent text nodes so the walk's shape — and the offsets — stay
 * stable). */
function unwrapMarks(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll("mark[data-annotation-id]"));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    mark.remove();
  }
  root.normalize();
}

// ── hover hit-testing (epic-24 T2) ───────────────────────────────────────

/**
 * Which annotation covers a text position (the hover-to-remove popover's
 * truth for the CSS Custom Highlight path — that path paints NO DOM, so the
 * pointer bridge resolves the caret to a (text node, offset) pair and this
 * answers which item — if any — covers it). The address math is the engine's
 * own: the node's section region (nearest preceding direct-child heading of
 * the article, else the intro contract) accumulates the offset, then the
 * fresh list answers. A stale range never reports a hit — it paints nothing,
 * so it must not be hoverable either. Text inside a heading is never
 * annotated (regions start after headings) — null. Pure DOM walk:
 * jsdom-testable; the caretRangeFromPoint/PositionFromPoint bridge lives in
 * annotation-hover.ts (browser-only).
 */
export function hitTestMarkdownAnnotation(
  article: HTMLElement,
  items: readonly AnnotationRenderItem[],
  introSectionId: string | null,
  node: Node,
  nodeOffset: number,
): string | null {
  if (node.nodeType !== Node.TEXT_NODE || !(article.contains(node))) return null;
  // Climb to the text node's block-level ancestor that is a DIRECT child of
  // the article (the react-markdown shape the region walks share).
  let block: Element | null = node.parentElement;
  while (block && block.parentElement !== article) block = block.parentElement;
  if (!block) return null;

  // The section this block belongs to: the nearest preceding heading with an
  // id among the article's direct children (headings ARE the addresses); a
  // heading itself never hosts annotations.
  const children = Array.from(article.children);
  const blockIndex = children.indexOf(block);
  if (blockIndex < 0) return null;
  let sectionId: string | null = null;
  for (let i = blockIndex; i >= 0; i--) {
    const child = children[i];
    if (/^[Hh][1-6]$/.test(child.tagName)) {
      const id = (child as HTMLElement).id;
      if (!id) return null; // unaddressed heading — no annotation region
      if (i === blockIndex) return null; // the caret sits IN a heading
      sectionId = id;
      break;
    }
  }
  if (sectionId === null) {
    // Before the first addressed heading — only the intro contract paints here.
    if (introSectionId === null) return null;
    sectionId = introSectionId;
  }

  const elements = markdownSectionElements(article, sectionId, introSectionId);
  if (!elements) return null;
  const nodes = collectTextNodes(elements);
  let offset = 0;
  let caret = -1;
  for (const text of nodes) {
    if (text === node) {
      caret = offset + nodeOffset;
      break;
    }
    offset += (text.nodeValue ?? "").length;
  }
  if (caret < 0) return null;
  const regionText = textOfNodes(nodes);
  for (const item of items) {
    if (item.range.sectionId !== sectionId) continue;
    if (!isValidAnnotationRange(item.range)) continue;
    if (isStaleRange(item.range, regionText)) continue;
    if (caret >= item.range.start && caret < item.range.end) return item.id;
  }
  return null;
}

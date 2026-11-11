/**
 * The roadmap graph's pure SPINE layout (epic-28 T2, FR-5; the owner-settled
 * roadmap.sh form factor — replaces the epic-10 derived-sequence engine and
 * the epic-16 swimlane DAG engine, both of which retire in T5). ZERO new
 * dependencies (NFR-6) — pure TS math, deterministic by contract.
 *
 * Geometry (measured off roadmap.sh's rendered SVG, 2026-11-10 teardown):
 * - Stage hubs stack on a vertical CENTER spine in stage order (first
 *   appearance in `order` — the epic-10 convention); stage-less nodes attach
 *   to a synthetic trailing hub (the renderer renders its i18n label).
 * - Each stage's leaves fan into a LEFT and a RIGHT column flanking the hub,
 *   stacked at the measured leaf pitch and vertically centered on the hub.
 *   Side split is deterministic: iterate leaves in (order, id) sequence,
 *   assign to the side with the fewer leaves, ties → left.
 * - Blocks stack top → bottom; a block's height is its tallest column, so
 *   same-side fans can never overlap by construction.
 *
 * Section discreteness (owner feedback round 2026-11-11): each stage's
 * leaves sit on ONE side — alternating by stage index (even → right, odd →
 * left), the roadmap.sh section-cluster shape — so every fan curve stays
 * strictly inside its own section band, and the side split is no longer
 * balanced. Cross-SECTION connectivity is the spine's job alone: a
 * prerequisite edge between leaves of DIFFERENT stages is deliberately NOT
 * rendered (the data persists; the spine already carries the ordering, and
 * a dotted line sweeping across sections reads as a mistake — owner ruling).
 * Same-stage prerequisites render as an outer bracket on that stage's side.
 *
 * Edges (three classes, NO arrowheads anywhere — direction is the top-down
 * geometry; stage-forward validity makes that lossless):
 * - `spine`  hub k → hub k+1, straight vertical (generated, one per
 *   consecutive hub pair — structural, not data).
 * - `fan`    hub → each of its leaves, the measured dotted S-curve
 *   (generated, one per leaf — structural).
 * - `prereq` same-stage pairs only (data, sanitized: unknown endpoints /
 *   self-pairs / duplicates drop, cross-stage pairs withheld).
 *
 * Edge `d` strings are built HERE (pure, rounded to 2 decimals) so the
 * renderer stays dumb and the byte-identical determinism pin covers the
 * paths too.
 *
 * Pure module (no react) — the component consumes hubs/boxes/edges
 * verbatim and builds its SVG from them.
 */

export interface SpineNodeInput {
  id: string;
  order: number;
  stage: string | null;
}

/** One persisted prerequisite edge — endpoint uuids verbatim from the api. */
export interface SpinePrereqInput {
  from: string;
  to: string;
}

/** Fixed node box geometry — the copied roadmap.sh proportions, scaled up
 *  one step (T03 owner round: bigger nodes, airier rows; FAN_GAP narrows so
 *  the frame stays ≈1190 and the nodes' on-screen share grows). */
export const SPINE_NODE_W = 310;
export const SPINE_NODE_H = 62;
/** Leaf stack pitch — the gap between rows opens 6.5 → 16px. */
export const SPINE_ROW_PITCH = 78;
/** The horizontal gap between a hub's edge and a fan's inner edge. */
export const SPINE_FAN_GAP = 100;
/** The vertical gap between consecutive stage blocks. */
export const SPINE_BLOCK_GAP = 56;
export const SPINE_PADDING = 30;
/** A two-line hub's extra height (the second 30px line + its leading). */
export const SPINE_HUB_SECOND_LINE = 40;
/** The hub title's per-line width budget (the box minus side insets). */
export const SPINE_HUB_LINE_PX = SPINE_NODE_W - 44;

/**
 * Split a hub title into 1–2 renderable lines at the measured width
 * (deterministic): prefer the LAST ：/:／· separator inside the first half
 * (「第 1 阶段：GraphQL 基础」 breaks after the colon), else the first
 * space, else a greedy width fill; the second line truncates if it still
 * overflows (never a third line).
 */
export function hubTitleLines(title: string): string[] {
  const width = (text: string) =>
    [...text].reduce((sum, ch) => sum + (ch.codePointAt(0)! > 0x2e7f ? 30 : 15.5), 0);
  if (width(title) <= SPINE_HUB_LINE_PX) return [title];

  const separators = ["：", ":", "—", "·", " "];
  for (const sep of separators) {
    const at = title.lastIndexOf(sep, Math.floor(title.length / 2) + 2);
    if (at > 0 && at < title.length - 1) {
      const head = title.slice(0, at + 1);
      const tail = title.slice(at + 1).trim();
      if (width(head) <= SPINE_HUB_LINE_PX && width(tail) <= SPINE_HUB_LINE_PX) return [head, tail];
    }
  }
  // Greedy fill: walk the string to the width budget, break there.
  let used = 0;
  let at = title.length;
  for (let i = 0; i < title.length; i += 1) {
    used += title.codePointAt(i)! > 0x2e7f ? 30 : 15.5;
    if (used > SPINE_HUB_LINE_PX) {
      at = i;
      break;
    }
  }
  const head = title.slice(0, at);
  const tail = title.slice(at);
  return [head, width(tail) <= SPINE_HUB_LINE_PX ? tail : `${tail.slice(0, Math.max(1, Math.floor(SPINE_HUB_LINE_PX / 28)))}…`];
}

export type SpineSide = "left" | "right";
export type SpineEdgeKind = "spine" | "fan" | "prereq";

export interface SpineBox {
  id: string;
  /** "hub" = a stage anchor on the spine (never interactive); "leaf" = a knowledge node. */
  kind: "hub" | "leaf";
  /** The stage label verbatim; null = the synthetic trailing (ungrouped) hub. */
  stage: string | null;
  /** Which fan column a leaf sits in; null on hubs. */
  side: SpineSide | null;
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  /** The box's own height — 51 for one-line boxes, taller for a two-line hub. */
  h: number;
}

export interface SpineHub {
  /** Synthetic hub id — `hub:<stageIndex>`; never collides with node uuids. */
  id: string;
  stage: string | null;
  /** The hub's title split into 1–2 renderable lines (width-measured). */
  lines: string[];
  leafIds: string[];
}

export interface SpineEdge {
  /** Hub id for spine/fan edges; node uuid for prereq edges. */
  from: string;
  to: string;
  kind: SpineEdgeKind;
  /** The final SVG path — built here so determinism covers the geometry. */
  d: string;
}

export interface SpineLayout {
  hubs: SpineHub[];
  boxes: Record<string, SpineBox>;
  edges: SpineEdge[];
  /** Leaf ids in keyboard reading order: stage by stage, left fan then right fan. */
  readingOrder: string[];
  width: number;
  height: number;
  /** The spine's center x — hubs center here. */
  centerX: number;
}

// The canvas always spans both fan columns + the spine, whether or not any
// stage currently uses the far side — the frame never narrows with data.
export const SPINE_WIDTH =
  SPINE_PADDING * 2 + SPINE_NODE_W + SPINE_FAN_GAP + SPINE_NODE_W + SPINE_FAN_GAP + SPINE_NODE_W;

/** The left/right fan columns' inner-edge x (a leaf's edge facing the spine). */
const LEFT_INNER_X = SPINE_PADDING;
const RIGHT_INNER_X = SPINE_WIDTH - SPINE_PADDING - SPINE_NODE_W;
const HUB_X = SPINE_PADDING + SPINE_NODE_W + SPINE_FAN_GAP;
export const SPINE_CENTER_X = HUB_X + SPINE_NODE_W / 2;

function byOrderThenId(a: SpineNodeInput, b: SpineNodeInput): number {
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The measured S-curve: hub side-port → column midline → leaf inner-port. */
function fanPath(hubPortX: number, hubY: number, leafInnerX: number, leafY: number): string {
  const midX = (hubPortX + leafInnerX) / 2;
  const leafMidY = leafY + SPINE_NODE_H / 2;
  return `M ${fmt(hubPortX)} ${fmt(hubY)} C ${fmt(midX)} ${fmt(hubY)} ${fmt(midX)} ${fmt(leafMidY)} ${fmt(leafInnerX)} ${fmt(leafMidY)}`;
}

/** Outer bracket on the shared side (same-side prereq pairs). */
function outerBracketPath(source: SpineBox, target: SpineBox): string {
  const out = (box: SpineBox) => (box.side === "right" ? box.x + SPINE_NODE_W : box.x);
  const bulge = (box: SpineBox) => (box.side === "right" ? 36 : -36);
  const sx = out(source);
  const tx = out(target);
  const sy = source.y + SPINE_NODE_H / 2;
  const ty = target.y + SPINE_NODE_H / 2;
  return `M ${fmt(sx)} ${fmt(sy)} C ${fmt(sx + bulge(source))} ${fmt(sy)} ${fmt(tx + bulge(target))} ${fmt(ty)} ${fmt(tx)} ${fmt(ty)}`;
}

/**
 * The deterministic spine layout described in the module doc. Empty input →
 * an empty layout with a positive minimum canvas (the empty-state graph
 * still paints its surface).
 */
export function roadmapSpineLayout(nodes: SpineNodeInput[], prereqs: SpinePrereqInput[]): SpineLayout {
  const sorted = [...nodes].sort(byOrderThenId);

  // Stage grouping, first-appearance order (the epic-10 precedent); stage-less
  // nodes trail in the synthetic ungrouped group.
  const groups: { stage: string | null; nodes: SpineNodeInput[] }[] = [];
  const byStage = new Map<string, SpineNodeInput[]>();
  for (const node of sorted) {
    if (node.stage === null) continue;
    let list = byStage.get(node.stage);
    if (!list) {
      list = [];
      byStage.set(node.stage, list);
      groups.push({ stage: node.stage, nodes: list });
    }
    list.push(node);
  }
  const ungrouped = sorted.filter((node) => node.stage === null);
  if (ungrouped.length > 0) groups.push({ stage: null, nodes: ungrouped });

  const boxes: Record<string, SpineBox> = {};
  const hubs: SpineHub[] = [];
  const readingOrder: string[] = [];
  const hubBottoms: number[] = [];

  let blockTop = SPINE_PADDING;
  groups.forEach((group, stageIndex) => {
    // Section discreteness (see the module doc): the whole stage's fan on
    // ONE side, alternating by stage index (even → right, odd → left) —
    // deterministic, and every curve stays inside its own section band.
    const left: SpineNodeInput[] = [];
    const right: SpineNodeInput[] = [];
    (stageIndex % 2 === 0 ? right : left).push(...group.nodes);

    // The hub grows a second line when its title cannot fit one (the owner's
    // overflow report) — the block and every edge ride the ACTUAL height.
    const lines = hubTitleLines(group.stage ?? "");
    const hubH = SPINE_NODE_H + (lines.length > 1 ? SPINE_HUB_SECOND_LINE : 0);
    const fanHeight = (count: number) => (count <= 0 ? 0 : count * SPINE_ROW_PITCH - (SPINE_ROW_PITCH - SPINE_NODE_H));
    const blockHeight = Math.max(hubH, fanHeight(left.length), fanHeight(right.length));
    const centerY = blockTop + blockHeight / 2;
    const hubId = `hub:${stageIndex}`;

    boxes[hubId] = { id: hubId, kind: "hub", stage: group.stage, side: null, x: HUB_X, y: centerY - hubH / 2, h: hubH };

    const leafIds: string[] = [];
    const placeFan = (list: SpineNodeInput[], side: SpineSide) => {
      const columnHeight = fanHeight(list.length);
      const top = centerY - columnHeight / 2;
      list.forEach((node, row) => {
        const x = side === "left" ? LEFT_INNER_X : RIGHT_INNER_X;
        const y = top + row * SPINE_ROW_PITCH;
        boxes[node.id] = { id: node.id, kind: "leaf", stage: group.stage, side, x, y, h: SPINE_NODE_H };
        leafIds.push(node.id);
        readingOrder.push(node.id);
      });
    };
    placeFan(left, "left");
    placeFan(right, "right");

    hubs.push({ id: hubId, stage: group.stage, lines, leafIds });
    hubBottoms.push(centerY + hubH / 2);
    blockTop += blockHeight + SPINE_BLOCK_GAP;
  });

  // Edges — generated structure first (spine + fan), then the sanitized
  // prereq data. Sorted deterministically within each class.
  const edges: SpineEdge[] = [];

  for (let i = 0; i < hubs.length - 1; i += 1) {
    const from = boxes[hubs[i].id];
    const to = boxes[hubs[i + 1].id];
    const x = SPINE_CENTER_X;
    edges.push({
      from: hubs[i].id,
      to: hubs[i + 1].id,
      kind: "spine",
      d: `M ${fmt(x)} ${fmt(from.y + from.h)} L ${fmt(x)} ${fmt(to.y)}`,
    });
  }

  for (const hub of hubs) {
    const hubBox = boxes[hub.id];
    const hubY = hubBox.y + hubBox.h / 2;
    for (const leafId of hub.leafIds) {
      const leaf = boxes[leafId];
      const hubPortX = leaf.side === "left" ? HUB_X : HUB_X + SPINE_NODE_W;
      const leafInnerX = leaf.side === "left" ? leaf.x + SPINE_NODE_W : leaf.x;
      edges.push({ from: hub.id, to: leafId, kind: "fan", d: fanPath(hubPortX, hubY, leafInnerX, leaf.y) });
    }
  }

  // Prereq data, sanitized (membership / self-pairs / dedupe — the server's
  // authority mirrored; the layout stays total on dirty data) AND section-
  // discrete: cross-stage pairs are WITHHELD from the rendering (the spine
  // carries inter-stage ordering — owner ruling 2026-11-11), so what remains
  // is same-stage pairs, always same-side → the outer bracket.
  const leafIds = new Set(sorted.map((node) => node.id));
  const stageOfLeaf = new Map(sorted.map((node) => [node.id, node.stage]));
  const seen = new Set<string>();
  const sanitized: { from: string; to: string }[] = [];
  for (const edge of prereqs) {
    if (!leafIds.has(edge.from) || !leafIds.has(edge.to) || edge.from === edge.to) continue;
    if (stageOfLeaf.get(edge.from) !== stageOfLeaf.get(edge.to)) continue; // the spine's job
    const key = `${edge.from}→${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push({ from: edge.from, to: edge.to });
  }
  sanitized.sort((a, b) => byId(a.from, b.from) || byId(a.to, b.to));

  for (const edge of sanitized) {
    const source = boxes[edge.from];
    const target = boxes[edge.to];
    edges.push({ from: edge.from, to: edge.to, kind: "prereq", d: outerBracketPath(source, target) });
  }

  // After the loop, blockTop sits one BLOCK_GAP past the last block's bottom.
  const lastBlockBottom = blockTop - SPINE_BLOCK_GAP;
  const height = groups.length === 0 ? SPINE_PADDING * 2 + SPINE_NODE_H : lastBlockBottom + SPINE_PADDING;

  return { hubs, boxes, edges, readingOrder, width: SPINE_WIDTH, height, centerX: SPINE_CENTER_X };
}

/**
 * The roadmap graph's pure DAG layout (epic-16 T2, FR-5; amends epic-10's
 * delta decision 1 — the custom-SVG canvas stays, structure upgrades to the
 * persisted prerequisite edges). ZERO new dependencies (NFR-6) — this module
 * rides the epic-10 layout module's geometry constants and falls back to it
 * verbatim for zero-edge plans.
 *
 * - Stages are swimlane columns ordered by stage position (first appearance
 *   in the node order — the same ranking the server's stage-forward validity
 *   uses); stage-less nodes park in the TRAILING default column (`stage:
 *   null`), exactly like the legacy layout.
 * - Within a column, nodes order by the BARYCENTER of their inbound edge
 *   sources' rows (columns resolve left → right, so every source row is
 *   final when a column orders; cycles are impossible by construction — the
 *   server only persists stage-forward edges). Ties — and nodes with no
 *   inbound edges, whose barycenter falls back to their initial (order, id)
 *   stack row — break by node id. The output never depends on input array
 *   order: deterministic by contract, pinned byte-identical by the test.
 * - Persisted edges render as orthogonal ELBOW polylines between column
 *   ports (source right-mid → gap midline → target row → target left-mid).
 *   Unknown endpoints, self-pairs, and duplicates drop (membership/dedupe
 *   mirror the server's authority; the layout stays total on dirty data).
 *
 * Pure module (no react) — the component consumes boxes/columns/edges
 * verbatim and builds its SVG from them.
 */
import {
  ROADMAP_COL_GAP,
  ROADMAP_HEADER_H,
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  ROADMAP_PADDING,
  ROADMAP_ROW_GAP,
  roadmapEdgePath,
  roadmapLayout,
  type RoadmapBox,
  type RoadmapColumn,
  type RoadmapLayout,
  type RoadmapNodeInput,
} from "./roadmap-layout";

// The ONE geometry source stays the epic-10 layout module — re-exported here
// so a consumer of either layout path imports its constants from one place.
export {
  ROADMAP_COL_GAP,
  ROADMAP_HEADER_H,
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  ROADMAP_PADDING,
  ROADMAP_ROW_GAP,
};
export type { RoadmapBox, RoadmapColumn, RoadmapEdge, RoadmapLayout, RoadmapNodeInput } from "./roadmap-layout";

/** One persisted prerequisite edge — endpoint uuids verbatim from the api. */
export interface DagEdgeInput {
  from: string;
  to: string;
}

export interface RoadmapDagEdge {
  from: string;
  to: string;
  kind: "prerequisite";
}

export interface RoadmapDagLayout {
  columns: RoadmapColumn[];
  boxes: Record<string, RoadmapBox>;
  edges: RoadmapDagEdge[];
  width: number;
  height: number;
}

/**
 * The per-plan layout selection (grill decision 6 — no stored positions, the
 * fallback is selected per-plan by edge presence): a plan WITH persisted
 * edges lays out as the swimlane DAG; a ZERO-edge plan (every legacy plan)
 * keeps the epic-10 derived-sequence layout verbatim.
 */
export type PlanGraphLayout =
  | { kind: "dag"; layout: RoadmapDagLayout }
  | { kind: "legacy"; layout: RoadmapLayout };

export function planGraphLayout(nodes: RoadmapNodeInput[], edges: DagEdgeInput[]): PlanGraphLayout {
  return edges.length > 0
    ? { kind: "dag", layout: roadmapDagLayout(nodes, edges) }
    : { kind: "legacy", layout: roadmapLayout(nodes) };
}

/** The path builder matching planGraphLayout's selection: elbows on the DAG,
 * the epic-10 bezier on the legacy fallback. */
export function planGraphEdgePath(kind: PlanGraphLayout["kind"], from: RoadmapBox, to: RoadmapBox): string {
  return kind === "dag" ? roadmapDagEdgePath(from, to) : roadmapEdgePath(from, to);
}

const COLUMN_PITCH = ROADMAP_NODE_W + ROADMAP_COL_GAP;
const ROW_PITCH = ROADMAP_NODE_H + ROADMAP_ROW_GAP;

function byOrderThenId(a: RoadmapNodeInput, b: RoadmapNodeInput): number {
  return (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function boxAt(id: string, column: number, row: number): RoadmapBox {
  return {
    id,
    column,
    row,
    x: ROADMAP_PADDING + column * COLUMN_PITCH,
    y: ROADMAP_PADDING + ROADMAP_HEADER_H + row * ROW_PITCH,
  };
}

/**
 * The deterministic DAG layout described in the module doc. Empty input → an
 * empty layout with a positive minimum canvas (the empty-state graph still
 * paints its surface).
 */
export function roadmapDagLayout(nodes: RoadmapNodeInput[], edges: DagEdgeInput[]): RoadmapDagLayout {
  const sorted = [...nodes].sort(byOrderThenId);

  // Column assignment, first-appearance stage order (the epic-10 precedent);
  // the null stage keys as its own trailing group.
  const staged: { stage: string; nodes: RoadmapNodeInput[] }[] = [];
  const unstaged: RoadmapNodeInput[] = [];
  const byStage = new Map<string, RoadmapNodeInput[]>();
  for (const node of sorted) {
    if (node.stage === null) {
      unstaged.push(node);
      continue;
    }
    let list = byStage.get(node.stage);
    if (!list) {
      list = [];
      byStage.set(node.stage, list);
      staged.push({ stage: node.stage, nodes: list });
    }
    list.push(node);
  }
  const columnsData = [...staged, ...(unstaged.length > 0 ? [{ stage: "", nodes: unstaged }] : [])];

  // Initial (order, id) stack rows — the barycenter's fallback key.
  const initialRow = new Map<string, number>();
  columnsData.forEach((group) => {
    group.nodes.forEach((node, row) => initialRow.set(node.id, row));
  });

  // Inbound sources per node over SANITIZED edges: unknown endpoints and
  // self-pairs drop (membership, mirroring the server); [from, to] dedupes.
  const nodeIds = new Set(sorted.map((node) => node.id));
  const seen = new Set<string>();
  const inbound = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) continue;
    const key = `${edge.from}→${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = inbound.get(edge.to);
    if (list) list.push(edge.from);
    else inbound.set(edge.to, [edge.from]);
  }

  // Column boxes resolve left → right: when a column orders, every potential
  // source's column (strictly earlier — the server persists stage-forward
  // edges only) already carries its final row.
  const columns: RoadmapColumn[] = [];
  const boxes: Record<string, RoadmapBox> = {};
  const rowOf = new Map<string, number>();
  const hasDefault = unstaged.length > 0;
  const maxRows = Math.max(1, ...columnsData.map((c) => c.nodes.length));
  columnsData.forEach((group, columnIndex) => {
    const ordered = [...group.nodes].sort((a, b) => {
      const ka = barycenterOf(a.id, columnIndex);
      const kb = barycenterOf(b.id, columnIndex);
      return (ka - kb) || byId(a.id, b.id);
    });
    columns.push({
      stage: hasDefault && columnIndex === columnsData.length - 1 ? null : group.stage,
      nodeIds: ordered.map((node) => node.id),
      x: ROADMAP_PADDING + columnIndex * COLUMN_PITCH,
    });
    ordered.forEach((node, row) => {
      boxes[node.id] = boxAt(node.id, columnIndex, row);
      rowOf.set(node.id, row);
    });
  });

  function barycenterOf(id: string, columnIndex: number): number {
    const sources = (inbound.get(id) ?? []).filter((sourceId) => {
      const row = rowOf.get(sourceId);
      return row !== undefined && boxes[sourceId].column < columnIndex;
    });
    if (sources.length === 0) return initialRow.get(id) ?? 0;
    return sources.reduce((sum, sourceId) => sum + (rowOf.get(sourceId) ?? 0), 0) / sources.length;
  }

  // Deterministic edge list: deduped (above), sorted by endpoints — the same
  // graph always emits the same sequence.
  const dagEdges: RoadmapDagEdge[] = [...seen]
    .map((key) => {
      const [from, to] = key.split("→");
      return { from, to, kind: "prerequisite" as const };
    })
    .sort((a, b) => byId(a.from, b.from) || byId(a.to, b.to));

  const width = ROADMAP_PADDING * 2 + columnsData.length * ROADMAP_NODE_W + Math.max(0, columnsData.length - 1) * ROADMAP_COL_GAP;
  const height = ROADMAP_PADDING * 2 + ROADMAP_HEADER_H + Math.max(0, maxRows - 1) * ROW_PITCH + ROADMAP_NODE_H;
  return { columns, boxes, edges: dagEdges, width, height };
}

/**
 * The orthogonal elbow polyline between two boxes' facing ports: the source's
 * RIGHT edge midpoint → the gap midline → vertical to the target's row → the
 * target's LEFT edge midpoint. A same-row pair collapses to a straight
 * horizontal line through the gap midpoint (no zero-length stubs).
 */
export function roadmapDagEdgePath(from: RoadmapBox, to: RoadmapBox): string {
  const x1 = from.x + ROADMAP_NODE_W;
  const y1 = from.y + ROADMAP_NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + ROADMAP_NODE_H / 2;
  const midX = (x1 + x2) / 2;
  if (y1 === y2) {
    return `M ${fmt(x1)} ${fmt(y1)} L ${fmt(midX)} ${fmt(y1)} L ${fmt(x2)} ${fmt(y2)}`;
  }
  return `M ${fmt(x1)} ${fmt(y1)} L ${fmt(midX)} ${fmt(y1)} L ${fmt(midX)} ${fmt(y2)} L ${fmt(x2)} ${fmt(y2)}`;
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

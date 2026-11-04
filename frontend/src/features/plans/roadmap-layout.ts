/**
 * The roadmap graph's pure layout (epic P2-10 T4, FR-5; delta decision 1 —
 * custom SVG renderer, ZERO new dependencies). Deterministic stage-column
 * layout over the plan's total `order`:
 *
 * - Stages are ordered by their first node's `order`; the stage-less nodes
 *   park in a TRAILING default column (`stage: null` — the component renders
 *   the i18n "未分组/Ungrouped" label).
 * - Nodes stack within their stage column in `order` (ties broken by id, so
 *   the output never depends on the input's order — deterministic by
 *   contract, pinned by the layout test).
 * - Edges: sequence edges between consecutive-`order` nodes within a stage
 *   (the global order walk, paired when both sides share a stage) + ONE
 *   connector from each column's last node to the next column's first node.
 * - Fixed node box size, no measurement-dependent layout: the same node list
 *   always yields the same positions (the 30+ node bar renders without a
 *   force/dag library — NFR-6 bundle discipline; the data model makes
 *   deterministic columns the structure-faithful rendering).
 *
 * Pure module (no react) — the component consumes boxes/columns/edges
 * verbatim and builds its SVG from them.
 */

export interface RoadmapNodeInput {
  id: string;
  order: number;
  stage: string | null;
}

/** Fixed node box geometry — layout never measures the DOM. */
export const ROADMAP_NODE_W = 172;
export const ROADMAP_NODE_H = 60;
export const ROADMAP_COL_GAP = 76;
export const ROADMAP_ROW_GAP = 36;
export const ROADMAP_PADDING = 28;
/** The stage header band above each column. */
export const ROADMAP_HEADER_H = 34;

export interface RoadmapBox {
  id: string;
  /** Column index (0-based, left → right). */
  column: number;
  /** Row index within the column (0-based, top → bottom). */
  row: number;
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
}

export interface RoadmapColumn {
  /** The stage label verbatim; null = the trailing default (ungrouped) column. */
  stage: string | null;
  nodeIds: string[];
  x: number;
}

export interface RoadmapEdge {
  from: string;
  to: string;
  /** "sequence" = consecutive-order same-stage; "stage-connector" = column boundary. */
  kind: "sequence" | "stage-connector";
}

export interface RoadmapLayout {
  columns: RoadmapColumn[];
  boxes: Record<string, RoadmapBox>;
  edges: RoadmapEdge[];
  width: number;
  height: number;
}

const COLUMN_PITCH = ROADMAP_NODE_W + ROADMAP_COL_GAP;
const ROW_PITCH = ROADMAP_NODE_H + ROADMAP_ROW_GAP;

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
 * The deterministic layout described in the module doc. Empty input → an
 * empty layout with a positive minimum canvas (the empty-state graph still
 * paints its surface).
 */
export function roadmapLayout(nodes: RoadmapNodeInput[]): RoadmapLayout {
  const sorted = [...nodes].sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Column assignment, first-appearance stage order (the stageGroups
  // precedent); the null stage keys as its own trailing group. Trailing is
  // enforced after the walk: the default column always renders last even
  // when its nodes carry the smallest orders.
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

  const columns: RoadmapColumn[] = [];
  const boxes: Record<string, RoadmapBox> = {};
  const hasDefault = unstaged.length > 0;
  const maxRows = Math.max(1, ...columnsData.map((c) => c.nodes.length));
  columnsData.forEach((group, columnIndex) => {
    columns.push({
      stage: hasDefault && columnIndex === columnsData.length - 1 ? null : group.stage,
      nodeIds: group.nodes.map((node) => node.id),
      x: ROADMAP_PADDING + columnIndex * COLUMN_PITCH,
    });
    group.nodes.forEach((node, row) => {
      boxes[node.id] = boxAt(node.id, columnIndex, row);
    });
  });

  // Sequence edges: the global order walk, paired when both sides share a
  // stage (consecutive-order nodes within a stage).
  const edges: RoadmapEdge[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.stage !== null && prev.stage === curr.stage) {
      edges.push({ from: prev.id, to: curr.id, kind: "sequence" });
    }
  }
  // Stage connectors: each column's last node → the next column's first node
  // (one per boundary, including into the trailing default column).
  for (let i = 1; i < columnsData.length; i += 1) {
    const from = columnsData[i - 1].nodes[columnsData[i - 1].nodes.length - 1];
    const to = columnsData[i].nodes[0];
    edges.push({ from: from.id, to: to.id, kind: "stage-connector" });
  }

  const width = ROADMAP_PADDING * 2 + columnsData.length * ROADMAP_NODE_W + Math.max(0, columnsData.length - 1) * ROADMAP_COL_GAP;
  const height = ROADMAP_PADDING * 2 + ROADMAP_HEADER_H + Math.max(0, maxRows - 1) * ROW_PITCH + ROADMAP_NODE_H;
  return { columns, boxes, edges, width, height };
}

/**
 * The cubic bezier `d` between two boxes' facing ports: the source's RIGHT
 * edge midpoint → the target's LEFT edge midpoint, control points pulling
 * horizontally through the gap. A same-row pair renders as a straight
 * horizontal line (zero curve), a column connector curves through the gap.
 */
export function roadmapEdgePath(from: RoadmapBox, to: RoadmapBox): string {
  const x1 = from.x + ROADMAP_NODE_W;
  const y1 = from.y + ROADMAP_NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + ROADMAP_NODE_H / 2;
  const dx = Math.max(ROADMAP_COL_GAP / 2, Math.abs(x2 - x1) / 2);
  return `M ${fmt(x1)} ${fmt(y1)} C ${fmt(x1 + dx)} ${fmt(y1)}, ${fmt(x2 - dx)} ${fmt(y2)}, ${fmt(x2)} ${fmt(y2)}`;
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

import { describe, expect, it } from "vitest";
import {
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  planGraphEdgePath,
  planGraphLayout,
  roadmapDagEdgePath,
  roadmapDagLayout,
  type DagEdgeInput,
  type RoadmapNodeInput,
} from "./roadmap-dag-layout";
import { roadmapLayout } from "./roadmap-layout";

/**
 * The roadmap graph's pure DAG layout (epic-16 T2, FR-5; grill decisions 4–6
 * — stage-forward edges, title-paired on the wire, no stored positions):
 * stages are swimlane columns ordered by stage position (first appearance in
 * node order), within-column order is the barycenter of inbound edge sources
 * (ties by node id), edges route as orthogonal elbow polylines between column
 * ports. Deterministic by contract: the same (nodes, edges) lists always
 * yield byte-identical output, independent of input array order. The
 * zero-edge legacy fallback selection (planGraphLayout → the epic-10
 * derived-sequence layout) is pinned here too.
 */

const n = (id: string, order: number, stage: string | null): RoadmapNodeInput => ({ id, order, stage });
const e = (from: string, to: string): DagEdgeInput => ({ from, to });

describe("roadmapDagLayout columns (stage swimlanes)", () => {
  it("orders columns by stage position (first appearance in node order) and stacks nodes within a column", () => {
    const layout = roadmapDagLayout(
      [n("sys-b", 3, "Systems"), n("alg-0", 0, "Algorithms"), n("sys-a", 2, "Systems"), n("alg-1", 1, "Algorithms")],
      [],
    );
    expect(layout.columns.map((c) => c.stage)).toEqual(["Algorithms", "Systems"]);
    expect(layout.columns[0].nodeIds).toEqual(["alg-0", "alg-1"]);
    expect(layout.columns[1].nodeIds).toEqual(["sys-a", "sys-b"]);
    expect(layout.columns[0].x).toBeLessThan(layout.columns[1].x);
  });

  it("parks stage-less nodes in a TRAILING default column (stage null), as the epic-10 layout does", () => {
    const layout = roadmapDagLayout([n("free-1", 4, null), n("staged", 1, "Basics"), n("free-0", 0, null)], []);
    expect(layout.columns.map((c) => c.stage)).toEqual(["Basics", null]);
    expect(layout.columns[1].nodeIds).toEqual(["free-0", "free-1"]);
  });
});

describe("roadmapDagLayout within-column barycenter ordering", () => {
  it("orders a column by the mean row of inbound edge sources (crossings minimized)", () => {
    // S1 rows: a=0, b=1, c=2. Inbound: c→x (bc 2), a→y (bc 0) → y before x.
    const layout = roadmapDagLayout(
      [n("x", 3, "S2"), n("y", 4, "S2"), n("a", 0, "S1"), n("b", 1, "S1"), n("c", 2, "S1")],
      [e("c", "x"), e("a", "y")],
    );
    expect(layout.columns[1].nodeIds).toEqual(["y", "x"]);
    expect(layout.boxes.y.row).toBe(0);
    expect(layout.boxes.x.row).toBe(1);
  });

  it("breaks barycenter ties by node id (never by input order)", () => {
    // Both x and y hang off a=0 → tie → id order.
    const layout = roadmapDagLayout(
      [n("y", 4, "S2"), n("x", 3, "S2"), n("a", 0, "S1")],
      [e("a", "x"), e("a", "y")],
    );
    expect(layout.columns[1].nodeIds).toEqual(["x", "y"]);
  });

  it("nodes with no inbound edges keep their (order, id) stack position deterministically", () => {
    // q hangs off a (bc 0); p has no inbound → its initial row (1) is its key.
    const layout = roadmapDagLayout(
      [n("p", 4, "S2"), n("q", 3, "S2"), n("a", 0, "S1")],
      [e("a", "q")],
    );
    expect(layout.columns[1].nodeIds).toEqual(["q", "p"]);
  });
});

describe("roadmapDagLayout edges (persisted prerequisites)", () => {
  it("carries the persisted edges verbatim as kind prerequisite (deduped, sorted, membership-checked)", () => {
    const layout = roadmapDagLayout(
      [n("a", 0, "S1"), n("b", 1, "S2"), n("c", 2, "S2")],
      [e("b", "c"), e("a", "b"), e("a", "b"), e("a", "ghost"), e("a", "a")],
    );
    expect(layout.edges).toEqual([
      { from: "a", to: "b", kind: "prerequisite" },
      { from: "b", to: "c", kind: "prerequisite" },
    ]);
  });
});

describe("roadmapDagEdgePath (orthogonal elbow polyline)", () => {
  it("runs from the source's right port to the target's left port through the column gap", () => {
    // f (S1 row 2) hangs b below d's fallback row, so a (row 0) → b (S2
    // row 1) truly elbows.
    const layout = roadmapDagLayout(
      [n("a", 0, "S1"), n("c", 1, "S1"), n("f", 2, "S1"), n("b", 3, "S2"), n("d", 4, "S2")],
      [e("f", "b")],
    );
    const a = layout.boxes.a;
    const b = layout.boxes.b;
    expect(a.row).toBe(0);
    expect(b.row).toBe(1);
    const d = roadmapDagEdgePath(a, b);

    const points = d
      .slice(1)
      .split("L")
      .map((seg) => seg.trim().split(/[\s,]+/).map(Number));
    // M point + 3 L points = the 4 elbow corners.
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual([a.x + ROADMAP_NODE_W, a.y + ROADMAP_NODE_H / 2]); // right port
    expect(points[3]).toEqual([b.x, b.y + ROADMAP_NODE_H / 2]); // left port
    // Orthogonal: every segment is horizontal or vertical.
    for (let i = 1; i < points.length; i += 1) {
      const [dx, dy] = [points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]];
      expect(dx === 0 || dy === 0).toBe(true);
    }
    // The elbow turns in the gap between the two columns.
    const midX = points[1][0];
    expect(midX).toBeGreaterThan(a.x + ROADMAP_NODE_W);
    expect(midX).toBeLessThan(b.x);
  });

  it("same-row pairs collapse to a straight horizontal line", () => {
    const layout = roadmapDagLayout([n("a", 0, "S1"), n("b", 1, "S2")], [e("a", "b")]);
    const a = layout.boxes.a;
    const b = layout.boxes.b;
    // b shifted onto a's row → y1 === y2 → two segments (straight through the
    // gap midpoint), still a → b port-to-port.
    const straight = roadmapDagEdgePath(a, { ...b, y: a.y });
    const points = straight.slice(1).split("L").map((seg) => seg.trim().split(/[\s,]+/).map(Number));
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual([a.x + ROADMAP_NODE_W, a.y + ROADMAP_NODE_H / 2]);
    expect(points[2]).toEqual([b.x, a.y + ROADMAP_NODE_H / 2]);
  });
});

describe("roadmapDagLayout determinism + geometry (16-node bar)", () => {
  // 4 stages × 4 nodes, a stage-forward chain + cross edges (the spec's scale cap).
  const fixtureNodes: RoadmapNodeInput[] = Array.from({ length: 16 }, (_, i) =>
    n(`node-${String(i).padStart(2, "0")}`, i, ["Foundations", "Practice", "Advanced", "Mastery"][Math.floor(i / 4)]),
  );
  const fixtureEdges: DagEdgeInput[] = [
    ...Array.from({ length: 15 }, (_, i) => e(`node-${String(i).padStart(2, "0")}`, `node-${String(i + 1).padStart(2, "0")}`)),
    e("node-00", "node-05"),
    e("node-01", "node-06"),
    e("node-04", "node-12"),
  ];

  it("lays 16 nodes out with every box inside the canvas and no overlap within a column", () => {
    const layout = roadmapDagLayout(fixtureNodes, fixtureEdges);
    const boxes = Object.values(layout.boxes);
    expect(boxes).toHaveLength(16);
    expect(layout.columns).toHaveLength(4);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + ROADMAP_NODE_W).toBeLessThanOrEqual(layout.width);
      expect(box.y + ROADMAP_NODE_H).toBeLessThanOrEqual(layout.height);
    }
    // Per column: one shared x, strictly increasing y (no overlap).
    const byColumn = new Map<number, typeof boxes>();
    for (const box of boxes) {
      const list = byColumn.get(box.column) ?? [];
      list.push(box);
      byColumn.set(box.column, list);
    }
    for (const list of byColumn.values()) {
      expect(new Set(list.map((b) => b.x)).size).toBe(1);
      const ys = list.map((b) => b.y).sort((p, q) => p - q);
      for (let i = 1; i < ys.length; i += 1) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(ROADMAP_NODE_H);
    }
  });

  it("is deterministic: shuffled inputs produce byte-identical output", () => {
    const a = roadmapDagLayout(fixtureNodes, fixtureEdges);
    const b = roadmapDagLayout([...fixtureNodes].reverse(), [...fixtureEdges].reverse());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual(b);
  });
});

describe("roadmapDagLayout empty input", () => {
  it("answers an empty layout with a positive minimum canvas", () => {
    const layout = roadmapDagLayout([], []);
    expect(layout.columns).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(Object.keys(layout.boxes)).toHaveLength(0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("planGraphLayout (the per-plan selection: DAG vs the epic-10 derived-sequence fallback)", () => {
  const nodes = [n("a", 0, "S1"), n("b", 1, "S1"), n("c", 2, "S2"), n("d", 3, "S2")];

  it("a zero-edge plan selects the LEGACY layout — the exact epic-10 derived-sequence output", () => {
    const selected = planGraphLayout(nodes, []);
    expect(selected.kind).toBe("legacy");
    if (selected.kind !== "legacy") return;
    expect(selected.layout).toEqual(roadmapLayout(nodes));
    // The derived-sequence vocabulary is present: sequence + stage-connector kinds.
    expect(selected.layout.edges.some((edge) => edge.kind === "stage-connector")).toBe(true);
  });

  it("an edge-carrying plan selects the DAG layout", () => {
    const selected = planGraphLayout(nodes, [e("a", "c")]);
    expect(selected.kind).toBe("dag");
    if (selected.kind !== "dag") return;
    expect(selected.layout.edges).toEqual([{ from: "a", to: "c", kind: "prerequisite" }]);
  });

  it("the matching path builder routes dag edges as elbows and legacy edges as beziers", () => {
    const legacy = roadmapLayout(nodes);
    const from = legacy.boxes.a;
    const to = legacy.boxes.b;
    expect(planGraphEdgePath("legacy", from, to)).toContain("C"); // cubic bezier
    expect(planGraphEdgePath("dag", from, to)).toContain("L"); // polyline
    expect(planGraphEdgePath("dag", from, to)).not.toContain("C");
  });
});

import { describe, expect, it } from "vitest";
import {
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  roadmapEdgePath,
  roadmapLayout,
  type RoadmapNodeInput,
} from "./roadmap-layout";

/**
 * The roadmap graph's pure layout (epic P2-10 T4, delta decision 1): stages
 * ordered by their first node's order, nodes stacked within their stage
 * column in order, the unstaged trailing default column, sequence edges
 * between consecutive-order same-stage nodes + one connector per stage
 * boundary, cubic bezier paths between ports. Deterministic output for the
 * same node list (fixed box size, no measurement, no randomness).
 */

const n = (id: string, order: number, stage: string | null): RoadmapNodeInput => ({ id, order, stage });

describe("roadmapLayout columns", () => {
  it("orders stages by their first node's order and stacks nodes within a column in order", () => {
    // "Algorithms" first appears at order 0, "Systems" at order 2 — despite
    // "Systems" nodes carrying smaller ids.
    const layout = roadmapLayout([
      n("sys-b", 3, "Systems"),
      n("alg-0", 0, "Algorithms"),
      n("sys-a", 2, "Systems"),
      n("alg-1", 1, "Algorithms"),
    ]);

    expect(layout.columns.map((c) => c.stage)).toEqual(["Algorithms", "Systems"]);
    expect(layout.columns[0].nodeIds).toEqual(["alg-0", "alg-1"]);
    expect(layout.columns[1].nodeIds).toEqual(["sys-a", "sys-b"]);
    // Column x offsets follow the fixed box + gap geometry.
    expect(layout.columns[0].x).toBeLessThan(layout.columns[1].x);
  });

  it("parks stage-less nodes in a TRAILING default column (stage null), in order", () => {
    const layout = roadmapLayout([
      n("free-1", 4, null),
      n("staged", 1, "Basics"),
      n("free-0", 0, null),
    ]);

    expect(layout.columns.map((c) => c.stage)).toEqual(["Basics", null]);
    expect(layout.columns[1].nodeIds).toEqual(["free-0", "free-1"]);
  });

  it("breaks order ties by id so the output never depends on input order (deterministic)", () => {
    const a = roadmapLayout([n("b", 0, "S"), n("a", 0, "S")]);
    const b = roadmapLayout([n("a", 0, "S"), n("b", 0, "S")]);
    expect(a).toEqual(b);
    expect(a.columns[0].nodeIds).toEqual(["a", "b"]);
  });

  it("answers an empty layout for an empty plan", () => {
    const layout = roadmapLayout([]);
    expect(layout.columns).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("roadmapLayout edges", () => {
  it("draws sequence edges between consecutive-order nodes within a stage", () => {
    // Global order walk: a(0)→b(1)→c(2) all in S1 (two sequence edges); a→c
    // are same stage but NOT consecutive in the walk they still pair through
    // b; x(5, S2) hangs off c by a stage connector, not a sequence edge.
    const layout = roadmapLayout([
      n("a", 0, "S1"),
      n("b", 1, "S1"),
      n("c", 2, "S1"),
      n("x", 5, "S2"),
    ]);
    expect(layout.edges).toContainEqual({ from: "a", to: "b", kind: "sequence" });
    expect(layout.edges).toContainEqual({ from: "b", to: "c", kind: "sequence" });
    expect(layout.edges.filter((e) => e.kind === "sequence")).toHaveLength(2);
    expect(layout.edges).toContainEqual({ from: "c", to: "x", kind: "stage-connector" });
  });

  it("connects each stage's last node to the next stage's first node (stage connectors)", () => {
    const layout = roadmapLayout([
      n("a", 0, "S1"),
      n("b", 1, "S1"),
      n("c", 2, "S2"),
      n("d", 3, "S2"),
      n("e", 9, null), // the default column connects from "d" (its previous column)
    ]);
    expect(layout.edges).toContainEqual({ from: "b", to: "c", kind: "stage-connector" });
    expect(layout.edges).toContainEqual({ from: "d", to: "e", kind: "stage-connector" });
    expect(layout.edges.filter((e) => e.kind === "stage-connector")).toHaveLength(2);
  });

  it("draws no edges for a single-node plan", () => {
    const layout = roadmapLayout([n("only", 0, null)]);
    expect(layout.edges).toEqual([]);
  });
});

describe("roadmapLayout geometry (30+ node bar)", () => {
  const fixture: RoadmapNodeInput[] = Array.from({ length: 36 }, (_, i) =>
    n(`node-${String(i).padStart(2, "0")}`, i, i < 12 ? "Foundations" : i < 24 ? "Practice" : i < 33 ? "Mastery" : null),
  );

  it("lays 36 nodes out with every box inside the canvas and no overlap within a column", () => {
    const layout = roadmapLayout(fixture);
    const boxes = Object.values(layout.boxes);
    expect(boxes).toHaveLength(36);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + ROADMAP_NODE_W).toBeLessThanOrEqual(layout.width);
      expect(box.y + ROADMAP_NODE_H).toBeLessThanOrEqual(layout.height);
    }
    // Per column, same x and strictly increasing y (no overlap).
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
    expect(byColumn.get(0)).toHaveLength(12);
    expect(byColumn.get(3)).toHaveLength(3); // the trailing default column
  });

  it("is deterministic: the same node list produces byte-identical positions", () => {
    expect(roadmapLayout(fixture)).toEqual(roadmapLayout([...fixture].reverse()));
  });
});

describe("roadmapEdgePath", () => {
  it("runs from the source's right port to the target's left port (cubic bezier)", () => {
    const layout = roadmapLayout([n("a", 0, "S"), n("b", 1, "S")]);
    const a = layout.boxes.a;
    const b = layout.boxes.b;
    const d = roadmapEdgePath(a, b);

    const start = d.slice(1, d.indexOf("C")).trim().split(/[\s,]+/).map(Number);
    expect(start).toEqual([a.x + ROADMAP_NODE_W, a.y + ROADMAP_NODE_H / 2]); // right port
    const end = d.split("C")[1].trim().split(/[\s,]+/).map(Number).slice(-2);
    expect(end).toEqual([b.x, b.y + ROADMAP_NODE_H / 2]); // left port
    // A cubic: exactly three coordinate pairs after C.
    expect(d.split("C")[1].trim().split(/[\s,]+/).map(Number)).toHaveLength(6);
  });
});

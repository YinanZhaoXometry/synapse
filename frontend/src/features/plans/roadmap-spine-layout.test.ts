import { describe, expect, it } from "vitest";

import {
  hubTitleLines,
  SPINE_CENTER_X,
  SPINE_FAN_GAP,
  SPINE_HUB_SECOND_LINE,
  SPINE_NODE_H,
  SPINE_NODE_W,
  SPINE_PADDING,
  SPINE_ROW_PITCH,
  SPINE_WIDTH,
  roadmapSpineLayout,
  type SpineNodeInput,
} from "./roadmap-spine-layout";

const node = (id: string, order: number, stage: string | null): SpineNodeInput => ({ id, order, stage });

describe("roadmapSpineLayout", () => {
  it("is byte-identical under shuffled input", () => {
    const nodes = [
      node("a", 1, "基础"),
      node("b", 2, "基础"),
      node("c", 3, "核心"),
      node("d", 4, "核心"),
      node("e", 5, "核心"),
      node("f", 6, null),
    ];
    const edges = [
      { from: "a", to: "c" },
      { from: "b", to: "e" },
    ];

    const straight = roadmapSpineLayout(nodes, edges);
    const shuffled = roadmapSpineLayout([...nodes].reverse(), [...edges].reverse());

    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(straight));
  });

  it("stacks hubs on the spine in first-appearance stage order, hubs centered per block", () => {
    const layout = roadmapSpineLayout([node("a", 5, "核心"), node("b", 1, "基础")], []);

    expect(layout.hubs.map((hub) => hub.stage)).toEqual(["基础", "核心"]);
    const [hub0, hub1] = layout.hubs;
    // Both hubs sit on the spine's center x…
    expect(layout.boxes[hub0.id].x + SPINE_NODE_W / 2).toBe(SPINE_CENTER_X);
    expect(layout.boxes[hub1.id].x + SPINE_NODE_W / 2).toBe(SPINE_CENTER_X);
    // …and never overlap vertically (each hub's block clears the previous).
    expect(layout.boxes[hub1.id].y).toBeGreaterThanOrEqual(layout.boxes[hub0.id].y + SPINE_NODE_H);
  });

  it("keeps a stage's leaves on ONE side, alternating by stage index (section discreteness)", () => {
    const layout = roadmapSpineLayout(
      [
        node("a", 1, "基础"),
        node("b", 2, "基础"),
        node("c", 1, "核心"),
        node("d", 2, "核心"),
        node("e", 1, "进阶"),
      ],
      [],
    );

    // Stage 0 (基础) → right; stage 1 (核心) → left; stage 2 (进阶) → right.
    expect(layout.boxes.a.side).toBe("right");
    expect(layout.boxes.b.side).toBe("right");
    expect(layout.boxes.c.side).toBe("left");
    expect(layout.boxes.d.side).toBe("left");
    expect(layout.boxes.e.side).toBe("right");
    // Leaf geometry rides the measured constants: inner edges flank the hub.
    for (const id of ["a", "b", "e"]) {
      expect(layout.boxes[id].x).toBe(SPINE_CENTER_X + SPINE_NODE_W / 2 + SPINE_FAN_GAP);
    }
    for (const id of ["c", "d"]) {
      expect(layout.boxes[id].x + SPINE_NODE_W).toBe(SPINE_CENTER_X - SPINE_NODE_W / 2 - SPINE_FAN_GAP);
    }
  });

  it("centers each fan on its hub with the measured row pitch", () => {
    const layout = roadmapSpineLayout(
      [node("a", 1, "基础"), node("b", 2, "基础"), node("c", 3, "基础"), node("d", 4, "基础")],
      [],
    );

    const hub = layout.hubs[0];
    const hubCenterY = layout.boxes[hub.id].y + SPINE_NODE_H / 2;
    const ids = hub.leafIds;

    // All 4 leaves on the stage's one side, stacked at the measured pitch…
    expect(ids).toHaveLength(4);
    const ys = ids.map((id) => layout.boxes[id].y);
    expect(ys[1] - ys[0]).toBe(SPINE_ROW_PITCH);
    // …and vertically centered on the hub.
    const mid = (ys[0] + ys[ys.length - 1] + SPINE_NODE_H) / 2;
    expect(mid).toBe(hubCenterY);
  });

  it("attaches stage-less nodes to a synthetic trailing hub", () => {
    const layout = roadmapSpineLayout([node("z", 9, null), node("a", 1, "基础")], []);

    expect(layout.hubs).toHaveLength(2);
    const ungrouped = layout.hubs[1];
    expect(ungrouped.stage).toBeNull();
    expect(ungrouped.leafIds).toEqual(["z"]);
    expect(layout.boxes["z"].stage).toBeNull();
  });

  it("emits structural spine + fan edges (no arrowheads; the d strings carry the geometry)", () => {
    const layout = roadmapSpineLayout(
      [node("a", 1, "基础"), node("b", 2, "核心"), node("c", 3, "核心")],
      [],
    );

    const spineEdges = layout.edges.filter((edge) => edge.kind === "spine");
    const fanEdges = layout.edges.filter((edge) => edge.kind === "fan");
    expect(spineEdges).toHaveLength(1);
    // The spine edge is a straight vertical segment hub → hub.
    const spine = spineEdges[0];
    expect(spine.d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    // One fan edge per leaf across every stage (a + b + c), hub → leaf, S-curve.
    expect(fanEdges).toHaveLength(3);
    for (const edge of fanEdges) {
      expect(edge.d).toMatch(/^M [\d.]+ [\d.]+ C /);
      expect(layout.boxes[edge.from].kind).toBe("hub");
      expect(layout.boxes[edge.to].kind).toBe("leaf");
    }
  });

  it("renders same-stage prereqs as outer brackets and withholds cross-stage pairs (the spine's job)", () => {
    const nodes = [
      node("a", 1, "基础"),
      node("b", 2, "基础"),
      node("c", 3, "基础"),
      node("d", 1, "核心"),
      node("e", 2, "核心"),
    ];
    const layout = roadmapSpineLayout(nodes, [
      { from: "a", to: "b" }, // same stage → bracket
      { from: "b", to: "c" }, // same stage → bracket
      { from: "a", to: "d" }, // cross stage → WITHHELD (the spine's job)
      { from: "d", to: "e" }, // cross stage → WITHHELD
    ]);

    const prereqs = layout.edges.filter((edge) => edge.kind === "prereq");
    // d→e is same-stage (核心) → bracket; a→d / d→e-shape cross pairs withheld.
    expect(prereqs.map((edge) => `${edge.from}→${edge.to}`).sort()).toEqual(["a→b", "b→c", "d→e"]);
    for (const edge of prereqs) {
      // Bracket: a cubic on the stage's outer side.
      expect(edge.d).toMatch(/^M -?[\d.]+ -?[\d.]+ C -?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+$/);
    }
  });

  it("drops dirty prereq edges — unknown endpoints, self-pairs, duplicates", () => {
    const nodes = [node("a", 1, "基础"), node("b", 2, "基础")];
    const layout = roadmapSpineLayout(nodes, [
      { from: "a", to: "b" },
      { from: "a", to: "b" },
      { from: "a", to: "ghost" },
      { from: "a", to: "a" },
    ]);

    expect(layout.edges.filter((edge) => edge.kind === "prereq")).toHaveLength(1);
  });

  it("handles the 16-node mixed case without any box overlap", () => {
    const stages = ["基础", "核心", "进阶", "应用"];
    const nodes: SpineNodeInput[] = [];
    let order = 1;
    for (const stage of stages) {
      for (let i = 0; i < 4; i += 1) nodes.push(node(`n-${stage}-${i}`, order++, stage));
    }
    const edges = Array.from({ length: 15 }, (_, i) => ({ from: nodes[i].id, to: nodes[i + 1].id }));

    const layout = roadmapSpineLayout(nodes, edges);

    expect(layout.hubs).toHaveLength(4);
    expect(layout.readingOrder).toHaveLength(16);
    const boxes = Object.values(layout.boxes);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const separated =
          a.x + SPINE_NODE_W <= b.x ||
          b.x + SPINE_NODE_W <= a.x ||
          a.y + SPINE_NODE_H <= b.y ||
          b.y + SPINE_NODE_H <= a.y;
        expect(separated).toBe(true);
      }
    }
    // The chain: 12 same-stage pairs render as brackets; the 3 cross-stage
    // seams are withheld (the spine's job).
    expect(layout.edges.filter((edge) => edge.kind === "prereq")).toHaveLength(12);
  });

  it("keeps a positive minimal canvas on empty input", () => {
    const layout = roadmapSpineLayout([], []);

    expect(layout.hubs).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(SPINE_WIDTH);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.readingOrder).toEqual([]);
  });

  it("grows tall, not wide — the canvas frame is data-independent", () => {
    const narrow = roadmapSpineLayout([node("a", 1, "基础")], []);
    const tall = roadmapSpineLayout(
      Array.from({ length: 16 }, (_, i) => node(`n${i}`, i + 1, `阶段${i % 4}`)),
      [],
    );

    expect(tall.width).toBe(narrow.width);
    expect(tall.height).toBeGreaterThan(narrow.height);
    expect(narrow.width).toBe(SPINE_PADDING * 2 + SPINE_NODE_W * 3 + SPINE_FAN_GAP * 2);
  });
});

describe("hubTitleLines (the hub's two-line wrap)", () => {
  it("keeps a short title on one line", () => {
    expect(hubTitleLines("基础奠基")).toEqual(["基础奠基"]);
    expect(hubTitleLines("第 1 阶段")).toEqual(["第 1 阶段"]);
  });

  it("breaks a long title at its colon into two fitting lines", () => {
    const lines = hubTitleLines("第 1 阶段：GraphQL 基础");
    expect(lines).toEqual(["第 1 阶段：", "GraphQL 基础"]);
  });

  it("truncates the second line when nothing fits (never a third line)", () => {
    const lines = hubTitleLines("一个非常非常非常非常非常非常非常非常长的没有分隔符的阶段标题");
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });
});

describe("the two-line hub geometry", () => {
  it("grows the hub box and the block for a wrapped title; edges ride the real height", () => {
    const longStage = "第 1 阶段：GraphQL 基础";
    const layout = roadmapSpineLayout([node("a", 1, longStage), node("b", 2, "核心")], []);

    const hub0 = layout.hubs[0];
    expect(hub0.lines).toEqual(["第 1 阶段：", "GraphQL 基础"]);
    const box0 = layout.boxes[hub0.id];
    const box1 = layout.boxes[layout.hubs[1].id];
    // The two-line hub is one second-line taller…
    expect(box0.h).toBe(SPINE_NODE_H + SPINE_HUB_SECOND_LINE);
    expect(box1.h).toBe(SPINE_NODE_H);
    // …the spine edge leaves from the TALLER box's real bottom…
    const spine = layout.edges.find((edge) => edge.kind === "spine")!;
    expect(spine.d).toBe(`M ${SPINE_CENTER_X} ${box0.y + box0.h} L ${SPINE_CENTER_X} ${box1.y}`);
    // …and no leaf overlaps the grown hub (block math held).
    for (const id of layout.readingOrder) {
      const leaf = layout.boxes[id];
      const separated =
        leaf.x + SPINE_NODE_W <= box0.x ||
        box0.x + SPINE_NODE_W <= leaf.x ||
        leaf.y + leaf.h <= box0.y ||
        box0.y + box0.h <= leaf.y;
      expect(separated).toBe(true);
    }
  });
});

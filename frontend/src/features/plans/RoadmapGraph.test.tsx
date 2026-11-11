import { fireEvent, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { installPointerEventShim } from "@/test/pointer-event-shim";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView, StudyMark } from "@/api/views";
import { nodeRowViews, type NodeRowView } from "./display-shaping";
import { SPINE_NODE_H, SPINE_NODE_W } from "./roadmap-spine-layout";
import RoadmapGraph from "./RoadmapGraph";

/**
 * The roadmap graph, spine era (epic-28 T3): a full-page hub-and-spoke SVG
 * browsed by page scroll — no zoom/pan/pinch affordances at all — in the
 * copied roadmap.sh skin (token-referenced), with the dual corner vocabulary
 * (Study Mark chip + mastery glyph) and the preserved keyboard contract
 * (roving tabindex re-pointed at reading order, Enter sheet, Esc, deep link).
 * The graph runs NO queries — PlanHome owns the batch reads — so these tests
 * mount it directly, no Apollo. jsdom renders unmeasured (scale 1), which is
 * exactly the deterministic posture the assertions ride.
 */

// jsdom 20 predates PointerEvent — the chip strip's touch suppression rides
// pointerType, so install the shared shim (src/test/pointer-event-shim.ts).
installPointerEventShim();

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string, vars?: Record<string, string>) => {
  let out = zhDict[key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, v);
  return out;
};

const NODE_COUNT = 12;
/** 5 Foundations + 4 Practice + 3 unstaged (the synthetic ungrouped hub). */
const stageOf = (i: number) => (i < 5 ? "Foundations" : i < 9 ? "Practice" : null);

const nodeAt = (i: number, overrides: Partial<KnowledgeNodeView> = {}): KnowledgeNodeView => ({
  id: `node-${String(i).padStart(2, "0")}`,
  planId: "plan-1",
  taskId: null,
  stage: stageOf(i),
  title: `Node ${i} 学习节点`,
  description: null,
  optional: false,
  studyMark: null,
  order: i,
  masteryScore: i === 5 ? "42" : "0",
  state: i === 5 ? "partial" : i === 4 ? "mastered" : "uncovered",
  ...overrides,
});

const NODES: KnowledgeNodeView[] = Array.from({ length: NODE_COUNT }, (_, i) => nodeAt(i));

const MATERIALS: MaterialView[] = [
  {
    id: "m-md",
    title: "Notes",
    kind: "markdown",
    sizeBytes: 1,
    planId: "plan-1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    parseFailureReason: undefined,
    sections: [{ id: "sec-1", title: "Raft", text: "leader election" }],
    createdAt: "2026-11-05T00:00:00Z",
    downloadUrl: null,
  },
];

const mappingRow = (overrides: Partial<MaterialNodeMappingView> = {}): MaterialNodeMappingView => ({
  id: "row-1",
  materialId: "m-md",
  nodeId: "node-05",
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "confirmed",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

/** The full provider wrapper as a standalone tree — lets a test `rerender` with changed views. */
const treeWith = (
  views: NodeRowView[],
  opts: {
    mappings?: MaterialNodeMappingView[];
    mappingsFailed?: boolean;
    edges?: { fromNodeId: string; toNodeId: string }[];
    initialEntries?: string[];
  } = {},
) => (
  <MockedProvider mocks={[]}>
    <MemoryRouter initialEntries={opts.initialEntries ?? ["/plan/plan-1"]}>
      <ThemeProvider>
        <LanguageProvider>
          <RoadmapGraph
          planId="plan-1"
          views={views}
          materials={MATERIALS}
          edges={opts.edges}
            mappings={"mappings" in opts ? opts.mappings : [mappingRow()]}
            mappingsFailed={opts.mappingsFailed ?? false}
          />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  </MockedProvider>
);

function mountGraph(
  opts: {
    mappings?: MaterialNodeMappingView[];
    mappingsFailed?: boolean;
    views?: NodeRowView[];
    edges?: { fromNodeId: string; toNodeId: string }[];
    initialEntries?: string[];
  } = {},
) {
  // "in" check — a destructuring default would swallow an EXPLICIT undefined
  // (the failed-read scenario passes mappings: undefined on purpose).
  return render(treeWith(opts.views ?? nodeRowViews(NODES, []), opts));
}

const nodeEl = (id: string) => document.querySelector(`[data-node-id="${id}"]`) as SVGElement | null;
const edges = () => Array.from(document.querySelectorAll("[data-testid='roadmap-edge']")) as SVGPathElement[];

beforeEach(() => {
  localStorage.clear();
});

describe("RoadmapGraph spine render", () => {
  it("renders 12 leaves across 3 hubs — Foundations, Practice, and the synthetic ungrouped hub", () => {
    mountGraph();
    expect(screen.getAllByTestId("roadmap-node")).toHaveLength(NODE_COUNT);
    const labels = screen.getAllByTestId("roadmap-stage-label").map((el) => el.textContent);
    expect(labels).toEqual(["Foundations", "Practice", zhDict["plans.stageUngrouped"]]);
    expect(screen.getByRole("group", { name: zhDict["plans.graphAria"] })).toBeInTheDocument();
    // Per-stage mastered/total rides each hub card.
    expect(screen.getAllByTestId("roadmap-stage-progress").map((el) => el.textContent)).toEqual(["1/5", "0/4", "0/3"]);
  });

  it("renders the copied skin through tokens only — hub face, leaf face, edge color, Balsamiq scope", () => {
    mountGraph();
    const svg = screen.getByTestId("roadmap-svg");
    expect(svg).toHaveClass("roadmap-font");
    // The hub carries the main-node fill; leaves the secondary fill.
    const hubRect = screen.getAllByTestId("roadmap-stage-group")[0].querySelector("rect")!;
    expect(hubRect.getAttribute("style")).toContain("var(--roadmap-hub-face)");
    const leafRect = nodeEl("node-00")!.querySelector("rect")!;
    expect(leafRect.getAttribute("style")).toContain("var(--roadmap-leaf-face)");
    // Every edge rides the edge token; the file holds no raw hex.
    for (const edge of edges()) {
      expect(edge.getAttribute("stroke")).toBe("var(--roadmap-edge)");
    }
  });

  it("classes edges: the spine solid, fans and prereqs dotted — and NO arrowheads anywhere", () => {
    mountGraph({
      edges: [
        { fromNodeId: "node-00", toNodeId: "node-05" }, // cross-stage pair
        { fromNodeId: "node-01", toNodeId: "node-02" }, // same-stage pair
      ],
    });
    const spine = edges().filter((e) => e.getAttribute("data-edge-kind") === "spine");
    const fans = edges().filter((e) => e.getAttribute("data-edge-kind") === "fan");
    const prereqs = edges().filter((e) => e.getAttribute("data-edge-kind") === "prereq");
    // Three hubs → two spine edges; 12 leaves → 12 fan edges. The two input
    // pairs: node-01→node-02 is same-stage (renders); node-00→node-05 is
    // cross-stage (WITHHELD — the spine's job).
    expect(spine).toHaveLength(2);
    expect(fans).toHaveLength(NODE_COUNT);
    expect(prereqs).toHaveLength(1);
    expect(prereqs[0].getAttribute("data-edge-from")).toBe("node-01");
    // Solid spine (no dasharray); dotted rest (the copied `0.8 8`).
    expect(spine[0].getAttribute("stroke-dasharray")).toBeNull();
    for (const dotted of [...fans, ...prereqs]) {
      expect(dotted.getAttribute("stroke-dasharray")).toBe("0.8 8");
    }
    // The retired arrowhead marker is gone from the document.
    expect(document.querySelector("#roadmap-arrow")).toBeNull();
  });

  it("the full-page posture: no zoom/pan affordances, the SVG fills its container width", () => {
    mountGraph();
    // The retired controls are gone…
    expect(screen.queryByTestId("roadmap-zoom-in")).toBeNull();
    expect(screen.queryByTestId("roadmap-zoom-out")).toBeNull();
    expect(screen.queryByTestId("roadmap-fit")).toBeNull();
    expect(screen.queryByTestId("roadmap-zoom-reset")).toBeNull();
    // …and so is the pannable viewport wrapper.
    expect(screen.queryByTestId("roadmap-viewport")).toBeNull();
    // The SVG is width-fitted (100%) with an auto height — page scroll is
    // the only navigation.
    const svg = screen.getByTestId("roadmap-svg");
    expect(svg.getAttribute("width")).toBe("100%");
  });

  it("hubs are anchors, not buttons: no role, no tabindex, no click-through", () => {
    mountGraph();
    const hub = screen.getAllByTestId("roadmap-stage-group")[0];
    expect(hub.getAttribute("role")).toBeNull();
    expect(hub.getAttribute("tabindex")).toBeNull();
    // Every interactive node is a leaf; hubs never appear among them.
    expect(screen.getAllByTestId("roadmap-node")).toHaveLength(NODE_COUNT);
  });

  it("keeps the select-none posture on the svg (page-scroll must not select titles)", () => {
    mountGraph();
    expect(screen.getByTestId("roadmap-svg")).toHaveClass("select-none");
  });

  it("wraps a long hub title into two centered lines inside the grown box", () => {
    const longStage = "第 1 阶段：GraphQL 基础";
    mountGraph({ views: nodeRowViews([nodeAt(0, { stage: longStage })], []) });

    const labels = screen.getAllByTestId("roadmap-stage-label").map((el) => el.textContent);
    expect(labels).toEqual(["第 1 阶段：", "GraphQL 基础"]);
    const hubRect = screen.getByTestId("roadmap-stage-group").querySelector("rect")!;
    expect(Number(hubRect.getAttribute("height"))).toBeGreaterThan(SPINE_NODE_H);
  });

  it("T03: hub and leaf rects carry the chunky roadmap.sh radius (rx=10)", () => {
    mountGraph();
    const hubRect = screen.getAllByTestId("roadmap-stage-group")[0].querySelector("rect")!;
    expect(hubRect.getAttribute("rx")).toBe("10");
    const leafRect = nodeEl("node-00")!.querySelector("rect")!;
    expect(leafRect.getAttribute("rx")).toBe("10");
  });
});

describe("RoadmapGraph state vocabulary (dual corner badges)", () => {
  it("renders the mastery glyph inline per node (✦◐○ — not color-only)", () => {
    mountGraph();
    expect(nodeEl("node-04")!.querySelector("[data-testid='roadmap-node-glyph']")!.textContent).toBe("✦");
    expect(nodeEl("node-05")!.querySelector("[data-testid='roadmap-node-glyph']")!.textContent).toBe("◐");
    expect(nodeEl("node-00")!.querySelector("[data-testid='roadmap-node-glyph']")!.textContent).toBe("○");
    // Leaf fill NEVER encodes mastery — every leaf wears the same copied face.
    for (const id of ["node-00", "node-04", "node-05"]) {
      expect(nodeEl(id)!.querySelector("rect")!.getAttribute("style")).toContain("var(--roadmap-leaf-face)");
    }
  });

  it("renders each mark as the top-right chip with its aria suffix (and nothing when unmarked)", () => {
    for (const mark of ["learning", "finished", "skipped"] as const) {
      const views = nodeRowViews([nodeAt(0, { studyMark: mark })], []);
      const { unmount } = mountGraph({ views });

      const chip = nodeEl("node-00")!.querySelector("[data-testid='roadmap-node-mark']");
      expect(chip).not.toBeNull();
      expect(chip!.getAttribute("data-mark")).toBe(mark);
      const labelKey = `plans.mark${mark[0].toUpperCase()}${mark.slice(1)}`;
      expect(nodeEl("node-00")!.getAttribute("aria-label")).toContain(zhDict[labelKey]);
      unmount();
    }

    mountGraph();
    expect(nodeEl("node-00")!.querySelector("[data-testid='roadmap-node-mark']")).toBeNull();
  });

  it("the progress bar stays pure mastery (AD-14) while the mark line counts marks beside it", () => {
    const views = nodeRowViews(
      [nodeAt(0, { studyMark: "finished" }), nodeAt(1, { studyMark: "learning" }), nodeAt(2, { studyMark: "finished" }), nodeAt(3)],
      [],
    );
    mountGraph({ views });

    expect(screen.getByTestId("roadmap-progress")).toHaveAttribute("aria-valuenow", "0");
    const line = screen.getByTestId("roadmap-marks-line").textContent!;
    expect(line).toBe(zh("plans.graphMarksLine", { finished: "2", learning: "1", skipped: "0" }));
  });

  it("draws optional nodes dashed with the 可选 marker and the optional aria", () => {
    mountGraph({ views: nodeRowViews([nodeAt(0, { optional: true })], []) });
    expect(nodeEl("node-00")!.querySelector("rect")!.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(screen.getByTestId("roadmap-node-optional")).toBeInTheDocument();
    expect(nodeEl("node-00")!.getAttribute("aria-label")).toBe(
      zh("plans.graphNodeAriaOptional", { node: "Node 0 学习节点", state: zhDict["plans.stateUncovered"] }),
    );
  });

  it("truncates long titles on the face and keeps the full title in the aria", () => {
    const long = "一个非常非常非常非常非常非常长的知识点标题超出盒子";
    mountGraph({ views: nodeRowViews([nodeAt(0, { title: long })], []) });
    const texts = Array.from(nodeEl("node-00")!.querySelectorAll("text")).map((el) => el.textContent ?? "");
    expect(texts.some((text) => text.endsWith("…"))).toBe(true);
    expect(nodeEl("node-00")!.getAttribute("aria-label")).toContain(long);
  });
});

describe("RoadmapGraph keyboard contract (re-pointed at the spine)", () => {
  it("roves the reading order with Up/Down and Enter opens the sheet, Esc closes", () => {
    mountGraph();
    // The roving tabindex seeds the FIRST reading-order leaf. One fan per
    // stage now: the reading order is the fan top→bottom (Foundations:
    // 00..04, then Practice).
    expect(nodeEl("node-00")!.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(nodeEl("node-00")!, { key: "ArrowDown" });
    expect(nodeEl("node-01")!.getAttribute("data-focused")).toBe("true");
    expect(nodeEl("node-00")!.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(nodeEl("node-01")!, { key: "Enter" });
    expect(screen.getByTestId("roadmap-detail")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("roadmap-detail")).toBeNull();
  });

  it("ArrowLeft/Right jumps to the nearest-row leaf across the spine (prev/next stage)", () => {
    // Stage 0 (right fan): node-00..02 top→bottom; stage 1 (left fan): node-03..05.
    const six = [
      ...Array.from({ length: 3 }, (_, i) => nodeAt(i, { stage: "Foundations", order: i })),
      ...Array.from({ length: 3 }, (_, i) => nodeAt(3 + i, { stage: "Practice", order: 3 + i })),
    ];
    mountGraph({ views: nodeRowViews(six, []) });

    // From stage 0's middle row, ArrowRight lands on stage 1's nearest row —
    // blocks are a row-block apart, so that is the fan's FIRST leaf.
    fireEvent.keyDown(nodeEl("node-01")!, { key: "ArrowRight" });
    expect(nodeEl("node-03")!.getAttribute("data-focused")).toBe("true");
    // And back: ArrowLeft returns to stage 0's nearest row (the block offset
    // makes that the fan's LAST leaf).
    fireEvent.keyDown(nodeEl("node-03")!, { key: "ArrowLeft" });
    expect(nodeEl("node-02")!.getAttribute("data-focused")).toBe("true");
  });

  it("focus is reachable by Tab and survives a layout identity change (reconciliation)", () => {
    const { rerender } = mountGraph();
    expect(nodeEl("node-00")!.getAttribute("tabindex")).toBe("0");
    // Refetch churn: a NEW views array with the same nodes — focus holds.
    rerender(treeWith(nodeRowViews(NODES.map((node) => ({ ...node })), [])));
    expect(nodeEl("node-00")!.getAttribute("tabindex")).toBe("0");
  });
});

describe("RoadmapGraph deep link (?node=)", () => {
  it("mount-only: selects + opens once; refetch churn re-runs nothing", () => {
    const { rerender } = render(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=node-03"] }));
    expect(nodeEl("node-03")!.getAttribute("data-focused")).toBe("true");
    expect(screen.getByTestId("roadmap-detail")).toBeInTheDocument();
    // Esc closes; a refetch (new array identity) must NOT re-open.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    rerender(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=node-03"] }));
    expect(screen.queryByTestId("roadmap-detail")).toBeNull();
  });

  it("a ghost id is attempted once and latched off (no sheet)", () => {
    const { rerender } = render(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=ghost"] }));
    expect(screen.queryByTestId("roadmap-detail")).toBeNull();
    rerender(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=ghost"] }));
    expect(screen.queryByTestId("roadmap-detail")).toBeNull();
  });
});

describe("RoadmapGraph node detail sheet", () => {
  it("click opens the sheet: title, score off evidence, description, and the jump actions", () => {
    const views = nodeRowViews(
      [nodeAt(5, { description: "Raft 选举的一行描述", masteryScore: "42", state: "partial" })],
      [
        { id: "ev-1", nodeId: "node-05", sessionId: null, questionId: null, outcome: "partial" as const, createdAt: "2026-11-05T01:00:00Z" },
      ],
    );
    mountGraph({ views, mappings: [mappingRow()] });

    fireEvent.click(nodeEl("node-05")!);
    const detail = screen.getByTestId("roadmap-detail");
    expect(detail).toHaveTextContent("Node 5 学习节点");
    expect(detail).toHaveTextContent("42%");
    expect(screen.getByTestId("roadmap-node-desc")).toHaveTextContent("Raft 选举的一行描述");
    // The confirmed mapping drives the direct study link to the reader.
    const study = screen.getByRole("link", { name: zh("plans.nodeStudyAria", { node: "Node 5 学习节点" }) });
    expect(study.getAttribute("href")).toBe("/read/m-md?hl=1#sec-1");
  });

  it("renders the mark badge on the sheet when the node carries one", () => {
    mountGraph({ views: nodeRowViews([nodeAt(0, { studyMark: "skipped" })], []) });
    fireEvent.click(nodeEl("node-00")!);
    expect(screen.getByTestId("roadmap-node-mark-badge")).toHaveTextContent(zhDict["plans.markSkipped"]);
  });

  it("an evidence-less node shows the honest em dash and the fallback description line", () => {
    mountGraph({ mappings: [] });
    fireEvent.click(nodeEl("node-00")!);
    const detail = screen.getByTestId("roadmap-detail");
    expect(detail).toHaveTextContent("—");
    expect(screen.getByTestId("roadmap-node-desc")).toHaveTextContent(zhDict["plans.graphNodeDescFallback"]);
  });

  it("a failed mappings read falls back to Quick Test only", () => {
    mountGraph({ mappings: undefined, mappingsFailed: true });
    fireEvent.click(nodeEl("node-00")!);
    const detail = screen.getByTestId("roadmap-detail");
    const quick = screen.getByRole("link", { name: zh("plans.nodeQuickTestAria", { node: "Node 0 学习节点" }) });
    expect(quick.getAttribute("href")).toBe("/plan/plan-1/quiz?nodeId=node-00");
    expect(detail.querySelector("a[href^='/read/']")).toBeNull();
  });

  it("an in-flight mappings read shows the pending line", () => {
    mountGraph({ mappings: undefined });
    fireEvent.click(nodeEl("node-00")!);
    expect(screen.getByText(zhDict["plans.graphActionsPending"])).toBeInTheDocument();
  });
});

describe("RoadmapGraph hover + empty", () => {
  it("hover opens the chip strip (title · state · mark) and leave hides it", async () => {
    const views = nodeRowViews([nodeAt(0, { studyMark: "learning" })], []);
    mountGraph({ views });

    fireEvent.pointerEnter(nodeEl("node-00")!, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const strip = screen.getByTestId("roadmap-chips");
    expect(strip).toHaveTextContent("Node 0 学习节点");
    expect(strip).toHaveTextContent(zhDict["plans.markLearning"]);

    fireEvent.pointerLeave(screen.getByTestId("roadmap-canvas"));
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
  });

  it("an empty plan renders the honest empty line", () => {
    mountGraph({ views: [] });
    expect(screen.getByText(zhDict["plans.graphEmpty"])).toBeInTheDocument();
  });
});

describe("RoadmapGraph hover chip strip (epic-28 T4)", () => {
  it("opens after the hover intent with toggles + actions, and closes on leave", async () => {
    mountGraph();
    fireEvent.pointerEnter(nodeEl("node-05")!, { pointerType: "mouse" });
    // Inside the 150ms intent window the strip is not up yet.
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 220));

    const strip = screen.getByTestId("roadmap-chips");
    expect(strip).toBeInTheDocument();
    // Row 1: the mark toggles; row 2: the actions (quick test always; study
    // link when the mapping read gave one).
    expect(strip.querySelector("[data-testid='study-mark-toggle']")).not.toBeNull();
    expect(strip.querySelector("[data-testid='node-quick-test']")).not.toBeNull();

    // Hiding is the CONTAINER's job (a strip mounted under a stationary
    // pointer never synthesizes per-element leave/enter).
    fireEvent.pointerLeave(screen.getByTestId("roadmap-canvas"));
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
  });

  it("never opens for touch pointers (tap stays the sheet contract)", async () => {
    mountGraph();
    fireEvent.pointerEnter(nodeEl("node-00")!, { pointerType: "touch" });
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
  });

  it("T03/T04: anchors on the node's top edge at its EXACT center, glass-faced, 4px gap", async () => {
    mountGraph();
    fireEvent.pointerEnter(nodeEl("node-05")!, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 220));

    const anchor = screen.getByTestId("roadmap-chips-anchor");
    const nodeRect = nodeEl("node-05")!.querySelector("rect")!;
    // The anchor sits exactly on the node's TOP EDGE at its horizontal
    // CENTER — no clamp anywhere (T04 deleted the canvas clamp), so the
    // strip's axis is always the node's axis.
    expect(Number.parseFloat(anchor.style.top)).toBeCloseTo(Number(nodeRect.getAttribute("y")));
    const expectedCenter = Number(nodeRect.getAttribute("x")) + SPINE_NODE_W / 2;
    expect(Number.parseFloat(anchor.style.left)).toBeCloseTo(expectedCenter);
    // The strip itself: 4px above the anchor, centered, glass token.
    const strip = screen.getByTestId("roadmap-chips");
    expect(strip.className).toContain("bottom-1");
    expect(strip.className).toContain("-translate-x-1/2");
    expect(strip.className).toContain("bg-[var(--popover-glass)]");
    expect(strip.className).not.toContain("bg-popover");
  });

  it("T04: leaving the NODE hides the strip (120ms grace) — no container trip needed", async () => {
    mountGraph();
    fireEvent.pointerEnter(nodeEl("node-05")!, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(screen.getByTestId("roadmap-chips")).toBeInTheDocument();

    // Pointer leaves the node into empty canvas (never leaves the canvas
    // div) — the strip must still hide.
    fireEvent.pointerLeave(nodeEl("node-05")!);
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
  });

  it("T04: entering the strip cancels the grace hide — the chips stay clickable", async () => {
    mountGraph();
    fireEvent.pointerEnter(nodeEl("node-05")!, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const strip = screen.getByTestId("roadmap-chips");

    // Node leave schedules; strip enter (the pointer rides up onto it)
    // cancels inside the grace window.
    fireEvent.pointerLeave(nodeEl("node-05")!);
    fireEvent.pointerEnter(strip, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(screen.getByTestId("roadmap-chips")).toBeInTheDocument();

    // Leaving the strip re-schedules the hide.
    fireEvent.pointerLeave(strip);
    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(screen.queryByTestId("roadmap-chips")).toBeNull();
  });

  it("the sheet carries the mark toggles + the evidence bar", () => {
    const views = nodeRowViews(
      [nodeAt(5, { studyMark: "learning" })],
      [
        { id: "ev-1", nodeId: "node-05", sessionId: null, questionId: null, outcome: "correct" as const, createdAt: "2026-11-05T01:00:00Z" },
        { id: "ev-2", nodeId: "node-05", sessionId: null, questionId: null, outcome: "wrong" as const, createdAt: "2026-11-05T02:00:00Z" },
      ],
    );
    mountGraph({ views });
    fireEvent.click(nodeEl("node-05")!);

    const detail = screen.getByTestId("roadmap-detail");
    const toggle = detail.querySelector("[data-testid='study-mark-toggle']");
    expect(toggle).not.toBeNull();
    expect(toggle!.querySelector("[data-testid='study-mark-learning']")!.getAttribute("aria-pressed")).toBe("true");
    // The evidence bar: the window's marks (wrong newest) + honest empty elsewhere.
    const marks = detail.querySelector("[data-testid='evidence-marks']");
    expect(marks).not.toBeNull();
    expect(marks!.textContent).not.toContain(zhDict["plans.noEvidence"]);
  });

  it("the evidence bar reads the honest empty line when no evidence exists", () => {
    mountGraph();
    fireEvent.click(nodeEl("node-00")!);
    const marks = screen.getByTestId("roadmap-detail").querySelector("[data-testid='evidence-marks']");
    expect(marks!.textContent).toContain(zhDict["plans.noEvidence"]);
  });

  it("the ask-AI handoff href carries the encoded draft before the anchor", () => {
    mountGraph();
    fireEvent.click(nodeEl("node-05")!);
    const ask = screen.getByTestId("node-ask-ai");
    const href = ask.getAttribute("href")!;
    expect(href.startsWith("/read/m-md?hl=1&companionAsk=")).toBe(true);
    expect(href.endsWith("#sec-1")).toBe(true);
    const draft = decodeURIComponent(href.split("companionAsk=")[1].split("#")[0]);
    expect(draft).toBe(zh("plans.companionAskDraft", { node: "Node 5 学习节点" }));
  });
});

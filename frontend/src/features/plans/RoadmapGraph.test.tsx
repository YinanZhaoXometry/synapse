import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView } from "@/api/views";
import { nodeRowViews, type NodeRowView } from "./display-shaping";
import RoadmapGraph from "./RoadmapGraph";

/**
 * The roadmap graph (epic P2-10 T4, FR-5; delta decision 1 — custom SVG,
 * deterministic stage columns, zero new deps): renders the 30+ node bar,
 * the T3 state vocabulary on the node face (glyph + tint, AD-9), the detail
 * side sheet with the SAME badge/score/T3 actions, keyboard traversal
 * (roving tabindex: up/down within a column, left/right across columns,
 * Enter opens, Esc closes), pan (pointer drag) + zoom (buttons + ctrl-wheel,
 * clamped), and the app's motion pref (reduce-motion → data-motion="off").
 * The graph itself runs NO queries — PlanHome owns the plan-scope batch read
 * and passes the rows down — so these tests mount it directly, no Apollo.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string, vars?: Record<string, string>) => {
  let out = zhDict[key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, v);
  return out;
};

// jsdom 20 predates PointerEvent — the pan contract rides pointer events, so
// shim the constructor over MouseEvent (RTL then builds real pointer events).
if (typeof window.PointerEvent === "undefined") {
  Object.defineProperty(window, "PointerEvent", { writable: true, value: class extends MouseEvent {} });
}

const NODE_COUNT = 36;
/** 12 Foundations + 12 Practice + 9 Mastery + 3 unstaged (the trailing default column). */
const stageOf = (i: number) => (i < 12 ? "Foundations" : i < 24 ? "Practice" : i < 33 ? "Mastery" : null);

const NODES: KnowledgeNodeView[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
  id: `node-${String(i).padStart(2, "0")}`,
  planId: "plan-1",
  taskId: null,
  stage: stageOf(i),
  title: `Node ${i} 学习节点`,
  order: i,
  masteryScore: i === 5 ? "42" : "0",
  state: i === 5 ? "partial" : i === 12 ? "mastered" : "uncovered",
  createdAt: "2026-11-05T00:00:00Z",
}));

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
  opts: { mappings?: MaterialNodeMappingView[]; mappingsFailed?: boolean } = {},
) => (
  <MemoryRouter>
    <ThemeProvider>
      <LanguageProvider>
        <RoadmapGraph
          planId="plan-1"
          views={views}
          materials={MATERIALS}
          mappings={"mappings" in opts ? opts.mappings : [mappingRow()]}
          mappingsFailed={opts.mappingsFailed ?? false}
        />
      </LanguageProvider>
    </ThemeProvider>
  </MemoryRouter>
);

function mountGraph(opts: { mappings?: MaterialNodeMappingView[]; mappingsFailed?: boolean; views?: NodeRowView[] } = {}) {
  // "in" check — a destructuring default would swallow an EXPLICIT undefined
  // (the failed-read scenario passes mappings: undefined on purpose).
  return render(treeWith(opts.views ?? nodeRowViews(NODES, []), opts));
}

const nodeEl = (id: string) => document.querySelector(`[data-node-id="${id}"]`) as SVGElement | null;

beforeEach(() => {
  localStorage.clear();
});

describe("RoadmapGraph render", () => {
  it("renders 36 nodes across 3 stage columns + the trailing default column", () => {
    mountGraph();
    expect(screen.getAllByTestId("roadmap-node")).toHaveLength(NODE_COUNT);
    // Stage headers render the stage DATA verbatim; the default column gets the i18n label.
    const labels = screen.getAllByTestId("roadmap-stage-label").map((el) => el.textContent);
    expect(labels).toEqual(["Foundations", "Practice", "Mastery", zhDict["plans.stageUngrouped"]]);
    expect(screen.getByRole("group", { name: zhDict["plans.graphAria"] })).toBeInTheDocument();
  });

  it("puts the state glyph on the node face (the T3 vocabulary, not color-only)", () => {
    mountGraph();
    // node-12 is mastered (✦), node-05 partial (◐) — glyphs ride the face.
    expect(nodeEl("node-12")?.textContent).toContain("\u2726");
    expect(nodeEl("node-05")?.textContent).toContain("\u25D0");
    expect(nodeEl("node-00")?.textContent).toContain("\u25CB");
  });

  it("announces each node by title and state (aria-label)", () => {
    mountGraph();
    const el = nodeEl("node-05")!;
    expect(el.getAttribute("aria-label")).toBe(
      zh("plans.graphNodeAria", { node: "Node 5 学习节点", state: zhDict["plans.statePartial"] }),
    );
    expect(el.getAttribute("role")).toBe("button");
  });

  it("opts the canvas out of text selection (drag-to-pan must not select node titles)", () => {
    mountGraph();
    expect(screen.getByTestId("roadmap-canvas")).toHaveClass("select-none");
  });
});

describe("RoadmapGraph detail sheet (the T3 actions, folded)", () => {
  it("click a mapped node → the sheet with badge, title, score, and the study action", async () => {
    mountGraph();
    fireEvent.click(nodeEl("node-05")!);

    const sheet = await screen.findByTestId("roadmap-detail");
    expect(sheet).toHaveTextContent("Node 5 学习节点");
    expect(screen.getByTestId("node-state-badge")).toHaveAttribute("data-state", "partial");
    expect(sheet).toHaveTextContent("42%");
    const study = screen.getByTestId("node-study-action");
    expect(study).toHaveAttribute("href", "/read/m-md?hl=1#sec-1");
    // The Quick Test stays reachable beside the study action.
    expect(screen.getByTestId("node-quick-test")).toBeInTheDocument();
  });

  it("click an unmapped node → the Quick Test action in the sheet", async () => {
    mountGraph();
    fireEvent.click(nodeEl("node-00")!);

    await screen.findByTestId("roadmap-detail");
    const quick = screen.getByTestId("node-quick-test");
    expect(quick).toHaveAttribute("href", "/plan/plan-1/quiz?nodeId=node-00");
    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
  });

  it("a failed batch read falls back to the Quick Test (the sheet never loses every action)", async () => {
    mountGraph({ mappings: undefined, mappingsFailed: true });
    fireEvent.click(nodeEl("node-05")!);

    await screen.findByTestId("roadmap-detail");
    expect(screen.getByTestId("node-quick-test")).toBeInTheDocument();
    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
  });

  it("Esc closes the sheet", async () => {
    mountGraph();
    fireEvent.click(nodeEl("node-00")!);
    await screen.findByTestId("roadmap-detail");

    fireEvent.keyDown(nodeEl("node-00")!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("roadmap-detail")).not.toBeInTheDocument());
  });
});

describe("RoadmapGraph keyboard traversal (AD-9)", () => {
  const tabbable = () => document.querySelector('[data-testid="roadmap-node"][tabindex="0"]');
  const roving = () => tabbable()?.getAttribute("data-node-id");

  it("arrows move the roving tabindex: down within the column, right across columns (same row), up back", () => {
    mountGraph();
    // Initial focus lands on the first node (roving tabindex seeded at 0:0).
    expect(roving()).toBe("node-00");

    const first = nodeEl("node-00")!;
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(roving()).toBe("node-01");

    fireEvent.keyDown(nodeEl("node-01")!, { key: "ArrowRight" });
    expect(roving()).toBe("node-13"); // column 1 (Practice), same row index 1

    fireEvent.keyDown(nodeEl("node-13")!, { key: "ArrowDown" });
    expect(roving()).toBe("node-14");

    fireEvent.keyDown(nodeEl("node-14")!, { key: "ArrowLeft" });
    expect(roving()).toBe("node-02"); // column 0, same row index 2

    fireEvent.keyDown(nodeEl("node-02")!, { key: "ArrowUp" });
    expect(roving()).toBe("node-01");

    fireEvent.keyDown(nodeEl("node-01")!, { key: "ArrowUp" });
    expect(roving()).toBe("node-00");

    // Clamped at the column's top edge.
    fireEvent.keyDown(nodeEl("node-00")!, { key: "ArrowUp" });
    expect(roving()).toBe("node-00");
  });

  it("Enter opens the focused node's detail sheet", async () => {
    mountGraph();
    fireEvent.focus(nodeEl("node-00")!);
    fireEvent.keyDown(nodeEl("node-00")!, { key: "Enter" });
    await screen.findByTestId("roadmap-detail");
    expect(screen.getByTestId("roadmap-detail")).toHaveTextContent("Node 0 学习节点");
  });

  it("arrowing to a node outside the clipped viewport pans the canvas to bring it into view", () => {
    mountGraph();
    const canvas = screen.getByTestId("roadmap-canvas");
    // STUB (honest): jsdom does no layout — clientWidth/clientHeight read 0 on
    // every element, so the visibility math has nothing to measure. Pin the
    // box the className declares (h-[440px]) plus a representative width.
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 800 });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 440 });
    const transform = () => screen.getByTestId("roadmap-viewport").style.transform;
    const tabbable = () => document.querySelector('[data-testid="roadmap-node"][tabindex="0"]') as SVGElement;

    fireEvent.focus(nodeEl("node-00")!);
    // Rows 1–3 still fit (row 3's bottom edge = 350+60 = 410 ≤ 440−16): no pan.
    fireEvent.keyDown(tabbable(), { key: "ArrowDown" });
    fireEvent.keyDown(tabbable(), { key: "ArrowDown" });
    fireEvent.keyDown(tabbable(), { key: "ArrowDown" });
    expect(tabbable().getAttribute("data-node-id")).toBe("node-03");
    expect(transform()).toBe("translate(0px, 0px) scale(1)");
    // Row 4 (node-04) sits at y=446 → bottom 506 > 424 margin line → pan up 82px.
    fireEvent.keyDown(tabbable(), { key: "ArrowDown" });
    expect(tabbable().getAttribute("data-node-id")).toBe("node-04");
    expect(transform()).toBe("translate(0px, -82px) scale(1)");
  });
});

describe("RoadmapGraph pan + zoom", () => {
  const canvas = () => screen.getByTestId("roadmap-canvas");
  const transform = () => screen.getByTestId("roadmap-viewport").style.transform;

  it("pointer drag pans the canvas (translate)", () => {
    mountGraph();
    expect(transform()).toBe("translate(0px, 0px) scale(1)");
    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas(), { clientX: 60, clientY: 40 });
    fireEvent.pointerUp(canvas());
    expect(transform()).toBe("translate(50px, 30px) scale(1)");
  });

  it("zoom buttons step and clamp between 0.5 and 2", () => {
    mountGraph();
    const zoomIn = screen.getByTestId("roadmap-zoom-in");
    const zoomOut = screen.getByTestId("roadmap-zoom-out");
    for (let i = 0; i < 6; i += 1) fireEvent.click(zoomIn);
    expect(transform()).toContain("scale(2)"); // clamped at max
    for (let i = 0; i < 10; i += 1) fireEvent.click(zoomOut);
    expect(transform()).toContain("scale(0.5)"); // clamped at min
  });

  it("ctrl/cmd + wheel zooms and clamps", () => {
    mountGraph();
    fireEvent.wheel(canvas(), { ctrlKey: true, deltaY: -100 });
    expect(transform()).toContain("scale(1.25)");
    for (let i = 0; i < 8; i += 1) fireEvent.wheel(canvas(), { ctrlKey: true, deltaY: -100 });
    expect(transform()).toContain("scale(2)");
    // Plain wheel (no ctrl/cmd) never zooms.
    fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(transform()).toContain("scale(2)");
  });

  it("the zoom reset button returns to identity", () => {
    mountGraph();
    fireEvent.click(screen.getByTestId("roadmap-zoom-in"));
    fireEvent.click(screen.getByTestId("roadmap-zoom-reset"));
    expect(transform()).toBe("translate(0px, 0px) scale(1)");
  });

  it("a pointer press on the zoom toolbar never starts a canvas drag (the real-click guard)", () => {
    mountGraph();
    const zoomIn = screen.getByTestId("roadmap-zoom-in");
    // Fidelity note (honest): neither jsdom 20 (no setPointerCapture at all)
    // nor user-event implements pointer-capture retargeting — the real-Chromium
    // mechanism that used to eat these buttons' clicks (canvas captured the
    // pointer, pointerup retargeted to the canvas, click synthesized on the
    // canvas instead). fireEvent.click therefore passes even without the fix.
    // The honest jsdom pin for the fix is the observable stopPropagation
    // contract: a press on the toolbar must not reach the canvas's
    // pointerdown handler, i.e. press-drag on a button must not pan.
    fireEvent.pointerDown(zoomIn, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas(), { clientX: 60, clientY: 40 });
    fireEvent.pointerUp(canvas());
    expect(transform()).toBe("translate(0px, 0px) scale(1)");
    // The click wiring itself survives a full press→click sequence.
    fireEvent.click(zoomIn);
    expect(transform()).toBe("translate(0px, 0px) scale(1.25)");
  });
});

describe("RoadmapGraph motion", () => {
  it("respects the app's motion setting: reduce-motion renders data-motion=off (no smooth transitions)", () => {
    localStorage.setItem("synapse-motion", "off");
    mountGraph();
    expect(screen.getByTestId("roadmap-canvas")).toHaveAttribute("data-motion", "off");
  });

  it("motion on by default", () => {
    mountGraph();
    expect(screen.getByTestId("roadmap-canvas")).toHaveAttribute("data-motion", "on");
  });
});

describe("RoadmapGraph focusedId reconciliation (graph stays Tab-reachable)", () => {
  const roving = () => document.querySelector('[data-testid="roadmap-node"][tabindex="0"]')?.getAttribute("data-node-id");

  it("reseeds the roving tabindex when the focused node leaves views while mounted", () => {
    const mounted = render(treeWith(nodeRowViews(NODES, [])));
    expect(roving()).toBe("node-00"); // seeded to the first node at mount

    // node-00 (the focused one) disappears from the plan's rows — no <g>
    // would carry tabIndex=0 anymore without the reconciliation effect.
    const reduced = nodeRowViews(NODES.filter((node) => node.id !== "node-00"), []);
    mounted.rerender(treeWith(reduced));
    expect(roving()).toBe("node-01"); // reseeded to the first node of column 0
  });
});

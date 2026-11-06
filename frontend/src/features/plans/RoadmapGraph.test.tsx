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
  description: null,
  optional: false,
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
  opts: {
    mappings?: MaterialNodeMappingView[];
    mappingsFailed?: boolean;
    edges?: { fromNodeId: string; toNodeId: string }[];
    initialEntries?: string[];
  } = {},
) => (
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

describe("RoadmapGraph layout selection (epic-16: persisted edges → DAG, zero edges → legacy)", () => {
  const small = nodeRowViews(
    [
      NODES[0], NODES[1], // Foundations rows 0/1
      NODES[12], NODES[13], // Practice rows 0/1
    ],
    [],
  );
  const edgePaths = () =>
    Array.from(document.querySelectorAll("[data-testid='roadmap-edge']")).map((p) => p.getAttribute("d") ?? "");

  it("a zero-edge plan renders the LEGACY bezier routes (present-day behavior kept)", () => {
    render(treeWith(small));
    const paths = edgePaths();
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((d) => d.includes("C"))).toBe(true);
  });

  it("an edge-carrying plan renders the DAG elbow polylines (no beziers)", () => {
    render(
      treeWith(small, {
        edges: [
          { fromNodeId: "node-00", toNodeId: "node-12" },
          { fromNodeId: "node-01", toNodeId: "node-13" },
        ],
      }),
    );
    const paths = edgePaths();
    expect(paths).toHaveLength(2);
    for (const d of paths) {
      expect(d).toContain("L");
      expect(d).not.toContain("C");
    }
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

  it("wheel zooms inside the canvas — plain wheel zooms, ctrl/cmd kept as alias; clamp unchanged (epic-16 zoom posture)", () => {
    mountGraph();
    // Plain wheel now zooms (the spec's roadmap.sh posture; the canvas is a
    // bounded surface — page-scroll hijack is not a concern).
    fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(transform()).toContain("scale(1.25)");
    // ctrl/cmd+wheel stays an alias of the same step.
    fireEvent.wheel(canvas(), { ctrlKey: true, deltaY: -100 });
    expect(transform()).toContain("scale(1.5)");
    // Max clamp unchanged from epic-10.
    for (let i = 0; i < 8; i += 1) fireEvent.wheel(canvas(), { deltaY: -100 });
    expect(transform()).toContain("scale(2)");
    // Min clamp unchanged from epic-10.
    for (let i = 0; i < 14; i += 1) fireEvent.wheel(canvas(), { deltaY: 100 });
    expect(transform()).toContain("scale(0.5)");
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

describe("RoadmapGraph epic-16 graph UX (T3)", () => {
  /** Node copy with the epic-16 metadata without touching the shared NODES fixtures. */
  const withMeta = (i: number, over: Partial<KnowledgeNodeView>): KnowledgeNodeView => ({ ...NODES[i], ...over });

  describe("stage containers + progress (server states only)", () => {
    it("renders a tinted group container per stage column with the stage's mastered/total", () => {
      mountGraph();
      // One container per column (3 stages + the trailing default column).
      expect(screen.getAllByTestId("roadmap-stage-group")).toHaveLength(4);
      // 12 Foundations + 12 Practice + 9 Mastery + 3 unstaged; node-12
      // (Practice) is the only mastered node — SERVER state, rendered not
      // recomputed (AD-14): Foundations 0/12, Practice 1/12, Mastery 0/9, default 0/3.
      const counts = screen.getAllByTestId("roadmap-stage-progress").map((el) => el.textContent);
      expect(counts).toEqual(["0/12", "1/12", "0/9", "0/3"]);
    });

    it("renders the plan progress bar above the canvas — mastered x of y + percent, off the server states", () => {
      mountGraph();
      const bar = screen.getByRole("progressbar", { name: zhDict["plans.graphProgressAria"] });
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
      expect(bar).toHaveAttribute("aria-valuenow", "3"); // round(1/36 * 100)
      // The visible label reads mastered x of y + percent.
      const label = bar.nextElementSibling as HTMLElement;
      expect(label.textContent).toBe("1/36 已掌握 · 3%");
    });
  });

  it("legend names the state vocabulary + the optional marker (not color-only)", () => {
    mountGraph();
    const legend = screen.getByTestId("roadmap-legend").textContent;
    expect(legend).toContain(zhDict["plans.stateMastered"]);
    expect(legend).toContain(zhDict["plans.statePartial"]);
    expect(legend).toContain(zhDict["plans.stateUncovered"]);
    expect(legend).toContain(zhDict["plans.nodeOptional"]);
  });

  it("optional nodes render a dashed border + a visible marker (not color-only) + the optional aria-label", () => {
    mountGraph({ views: nodeRowViews([withMeta(1, { optional: true }), NODES[2]], []) });
    const g = nodeEl("node-01")!;
    expect(g.querySelector("rect")?.getAttribute("stroke-dasharray")).toBe("6 4");
    // The non-color marker carries the word.
    expect(g.querySelector("[data-testid='roadmap-node-optional']")?.textContent).toContain(zhDict["plans.nodeOptional"]);
    expect(g.getAttribute("aria-label")).toBe(
      zh("plans.graphNodeAriaOptional", { node: "Node 1 学习节点", state: zhDict["plans.stateUncovered"] }),
    );
  });

  it("solid topic nodes keep the undashed border and the plain aria-label", () => {
    mountGraph();
    const g = nodeEl("node-00")!;
    expect(g.querySelector("rect")?.getAttribute("stroke-dasharray")).toBeNull();
    expect(g.querySelector("[data-testid='roadmap-node-optional']")).toBeNull();
    expect(g.getAttribute("aria-label")).toBe(
      zh("plans.graphNodeAria", { node: "Node 0 学习节点", state: zhDict["plans.stateUncovered"] }),
    );
  });

  it("DAG prerequisite edges carry arrowheads and dash through optional nodes (the optional path)", () => {
    render(
      treeWith(nodeRowViews([NODES[0], NODES[1], NODES[12], withMeta(13, { optional: true })], []), {
        edges: [
          { fromNodeId: "node-00", toNodeId: "node-12" },
          { fromNodeId: "node-01", toNodeId: "node-13" },
        ],
      }),
    );
    const edge = (to: string) => document.querySelector(`[data-testid='roadmap-edge'][data-edge-to='${to}']`);
    // The arrowhead marker exists and every prerequisite edge ends in it.
    expect(document.querySelector("[data-testid='roadmap-svg'] marker")).not.toBeNull();
    expect(edge("node-12")?.getAttribute("marker-end")).toContain("roadmap-arrow");
    // The edge touching the optional node renders dashed; the plain edge does not.
    expect(edge("node-13")?.getAttribute("stroke-dasharray")).toBe("5 4");
    expect(edge("node-12")?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("hovering a node shows a tooltip with title + state (+ the optional marker when present)", () => {
    mountGraph({ views: nodeRowViews([withMeta(1, { optional: true }), NODES[5]], []) });
    expect(screen.queryByTestId("roadmap-tooltip")).not.toBeInTheDocument();

    fireEvent.pointerEnter(nodeEl("node-01")!);
    let tip = screen.getByTestId("roadmap-tooltip");
    expect(tip).toHaveTextContent("Node 1 学习节点");
    expect(tip).toHaveTextContent(zhDict["plans.stateUncovered"]);
    expect(tip).toHaveTextContent(zhDict["plans.nodeOptional"]);

    fireEvent.pointerLeave(nodeEl("node-01")!);
    expect(screen.queryByTestId("roadmap-tooltip")).not.toBeInTheDocument();

    fireEvent.pointerEnter(nodeEl("node-05")!);
    tip = screen.getByTestId("roadmap-tooltip");
    expect(tip).toHaveTextContent("Node 5 学习节点");
    expect(tip).toHaveTextContent(zhDict["plans.statePartial"]);
    expect(tip.textContent).not.toContain(zhDict["plans.nodeOptional"]);
  });

  describe("fit-view", () => {
    const canvas = () => screen.getByTestId("roadmap-canvas");
    const transform = () => screen.getByTestId("roadmap-viewport").style.transform;
    const stubViewport = (el: HTMLElement, w: number, h: number) => {
      Object.defineProperty(el, "clientWidth", { configurable: true, value: w });
      Object.defineProperty(el, "clientHeight", { configurable: true, value: h });
    };
    const parts = () => {
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(transform())!;
      return { x: parseFloat(m[1]), y: parseFloat(m[2]), k: parseFloat(m[3]) };
    };
    const fourNodes = nodeRowViews([NODES[0], NODES[1], NODES[12], NODES[13]], []);

    it("rescales and recenters the whole roadmap into the viewport (small plan fits under the cap)", () => {
      mountGraph({ views: fourNodes });
      stubViewport(canvas(), 800, 440);
      // Drift away first — fit must recover from any pan/zoom state.
      fireEvent.click(screen.getByTestId("roadmap-zoom-in"));
      expect(transform()).toContain("scale(1.25)");

      fireEvent.click(screen.getByTestId("roadmap-fit"));
      // Layout 476×246 → k = min(776/476, 416/246, 1.15 cap) = 1.15, centered.
      const { x, y, k } = parts();
      expect(k).toBeCloseTo(1.15, 5);
      expect(x).toBeCloseTo((800 - 476 * 1.15) / 2, 5);
      expect(y).toBeCloseTo((440 - 246 * 1.15) / 2, 5);
    });

    it("stays inside the epic-10 clamp: a 36-node roadmap fits at the min zoom floor", () => {
      mountGraph();
      stubViewport(canvas(), 800, 440);
      fireEvent.click(screen.getByTestId("roadmap-fit"));
      // Layout 972×1206 → raw fit 0.345 clamps to the 0.5 floor (clamp unchanged).
      const { x, y, k } = parts();
      expect(k).toBeCloseTo(0.5, 5);
      expect(x).toBeCloseTo((800 - 972 * 0.5) / 2, 5);
      expect(y).toBeCloseTo((440 - 1206 * 0.5) / 2, 5);
    });
  });

  describe("?node= deep-link", () => {
    /**
     * jsdom does no layout — the deep-link's pan-into-view reads the canvas'
     * measured viewport. Pin a representative viewport on the PROTOTYPE for
     * the mount (the effect runs at commit, before an instance-level stub
     * could land), then restore — the same honest stub the pan test makes.
     */
    const withViewport = (w: number, h: number, run: () => void) => {
      // Walk up to the prototype that owns the clientWidth accessor (jsdom
      // implements it on Element, not HTMLElement).
      let owner: object = window.HTMLElement.prototype;
      while (owner && !Object.getOwnPropertyDescriptor(owner, "clientWidth")) {
        owner = Object.getPrototypeOf(owner);
      }
      const wDesc = Object.getOwnPropertyDescriptor(owner, "clientWidth")!;
      const hDesc = Object.getOwnPropertyDescriptor(owner, "clientHeight")!;
      Object.defineProperty(owner, "clientWidth", { configurable: true, get: () => w });
      Object.defineProperty(owner, "clientHeight", { configurable: true, get: () => h });
      try {
        run();
      } finally {
        Object.defineProperty(owner, "clientWidth", wDesc);
        Object.defineProperty(owner, "clientHeight", hDesc);
      }
    };
    const roving = () => document.querySelector('[data-testid="roadmap-node"][tabindex="0"]')?.getAttribute("data-node-id");

    it("selects the node, pans it into view, moves the roving tabindex, and opens the sheet on mount", () => {
      withViewport(800, 440, () => {
        render(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=node-20"] }));
      });
      // node-20 (Practice, row 8): top y = 62+8·96 = 830, bottom 890 > 440−16 → pan −466px.
      expect(roving()).toBe("node-20");
      expect(screen.getByTestId("roadmap-viewport").style.transform).toBe("translate(0px, -466px) scale(1)");
      const sheet = screen.getByTestId("roadmap-detail");
      expect(sheet).toHaveTextContent("Node 20 学习节点");
    });

    it("ignores a deep-link id that is not one of the plan's nodes", () => {
      render(treeWith(nodeRowViews(NODES, []), { initialEntries: ["/plan/plan-1?node=ghost"] }));
      expect(roving()).toBe("node-00");
      expect(screen.queryByTestId("roadmap-detail")).not.toBeInTheDocument();
      expect(screen.getByTestId("roadmap-viewport").style.transform).toBe("translate(0px, 0px) scale(1)");
    });
  });

  it("the sheet gains the description line and the optional badge", async () => {
    mountGraph({ views: nodeRowViews([withMeta(0, { description: "一句话描述这个节点", optional: true }), NODES[1]], []) });
    fireEvent.click(nodeEl("node-00")!);
    await screen.findByTestId("roadmap-detail");
    expect(screen.getByTestId("roadmap-node-desc")).toHaveTextContent("一句话描述这个节点");
    expect(screen.getByTestId("roadmap-node-optional-badge")).toHaveTextContent(zhDict["plans.nodeOptional"]);

    // A plain node: no badge, and the honest fallback line (legacy nodes never
    // carry a description — the field is a new-generation artifact).
    fireEvent.click(nodeEl("node-01")!);
    await waitFor(() =>
      expect(screen.getByTestId("roadmap-node-desc")).toHaveTextContent(zhDict["plans.graphNodeDescFallback"]),
    );
    expect(screen.queryByTestId("roadmap-node-optional-badge")).not.toBeInTheDocument();
  });
});

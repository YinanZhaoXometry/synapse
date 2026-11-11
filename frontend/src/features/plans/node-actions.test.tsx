/**
 * NodeActions — the AI 讲解 entry (epic-34 T2, FR-11's node face). The ONE
 * implementation every node-shaped surface renders verbatim, so the contract
 * pins at the component: the teach action is ALWAYS rendered (mapped,
 * unmapped, in-flight, failed-read — never mapping-gated, GLOSSARY AI 讲解),
 * the retired mapping-gated 「问 AI 导师」 reader jump is gone, and the click
 * hands (nodeId, nodeTitle) to the plan page shell (the drawer opener).
 * userEvent-first (epic-17 convention).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import NodeActions from "./node-actions";
import type { NodeJumpTarget } from "./node-state";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

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
    origin: "uploaded",
    generation: null,
  },
];

const mappingRow = (overrides: Partial<MaterialNodeMappingView> = {}): MaterialNodeMappingView => ({
  id: "row-1",
  materialId: "m-md",
  nodeId: "n-1",
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "confirmed",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const onTeach = vi.fn();
const onLesson = vi.fn();

function mount({
  targets = null,
  failed = false,
  lessonMaterialId = null,
  lessonHint = null,
}: {
  targets?: NodeJumpTarget[] | null;
  failed?: boolean;
  /** epic-36 T2: the node's existing lesson id, null = none. */
  lessonMaterialId?: string | null;
  /** epic-36 T2: the composed cost hint (estimate × remaining), null while either read is in flight. */
  lessonHint?: string | null;
}) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <NodeActions
          targets={targets}
          failed={failed}
          planId="plan-1"
          nodeId="n-1"
          nodeTitle="Consensus"
          onTeach={onTeach}
          lessonMaterialId={lessonMaterialId}
          lessonHint={lessonHint}
          onLesson={onLesson}
        />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  onTeach.mockClear();
  onLesson.mockClear();
});

describe("NodeActions — the AI 讲解 entry (epic-34 T2)", () => {
  it("renders the teach action on a mapped node (targets resolved) and hands the node over on click", async () => {
    mount({
      targets: [
        { mappingId: "row-1", materialId: "m-md", sectionId: "sec-1", title: "Raft", href: "/read/m-md?hl=1#sec-1" },
      ],
    });

    const teach = screen.getByTestId("node-teach");
    expect(teach).toHaveTextContent(zhDict["plans.nodeTeachAction"]);
    expect(teach.getAttribute("aria-label")).toBe(zhDict["plans.nodeTeachAria"].replace("{node}", "Consensus"));

    await userEvent.click(teach);
    expect(onTeach).toHaveBeenCalledExactlyOnceWith("n-1", "Consensus");
  });

  it("renders the teach action on an UNMAPPED node — the mapping gate is gone", async () => {
    // Zero confirmed mappings: the study link never renders, the teach entry
    // still does (GLOSSARY AI 讲解 — every node has a way to start learning).
    mount({ targets: [] });

    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("node-jump-trigger")).not.toBeInTheDocument();
    const teach = screen.getByTestId("node-teach");

    await userEvent.click(teach);
    expect(onTeach).toHaveBeenCalledExactlyOnceWith("n-1", "Consensus");
  });

  it("renders the teach action while the mapping read is IN FLIGHT (targets null)", async () => {
    mount({ targets: null });

    expect(screen.getByTestId("node-teach")).toBeInTheDocument();
    expect(screen.queryByTestId("node-quick-test")).not.toBeInTheDocument(); // no honest fallback mid-flight yet
  });

  it("renders the teach action on a FAILED mapping read (beside the Quick Test fallback)", async () => {
    mount({ targets: null, failed: true });

    expect(screen.getByTestId("node-quick-test")).toBeInTheDocument();
    const teach = screen.getByTestId("node-teach");

    await userEvent.click(teach);
    expect(onTeach).toHaveBeenCalledExactlyOnceWith("n-1", "Consensus");
  });

  it("the retired mapping-gated 「问 AI 导师」 node action is replaced — node-ask-ai never renders anywhere", () => {
    // The old action rendered ONLY with a study target; on the strongest case
    // (targets present) it must still be gone — replaced, not adjacent.
    mount({
      targets: [
        { mappingId: "row-1", materialId: "m-md", sectionId: "sec-1", title: "Raft", href: "/read/m-md?hl=1#sec-1" },
      ],
    });

    expect(screen.queryByTestId("node-ask-ai")).not.toBeInTheDocument();
  });
});

// ── epic-36 T2: the 「生成讲义」 entry (beside AI 讲解, independent) ──────────

describe("NodeActions — the 生成讲义 entry (epic-36 T2)", () => {
  const target = { mappingId: "row-1", materialId: "m-md", sectionId: "sec-1", title: "Raft", href: "/read/m-md?hl=1#sec-1" };

  it("renders the independent lesson action beside AI 讲解 on a MAPPED node — clickable with the cost hint visible", async () => {
    mount({ targets: [target], lessonHint: "预计 5–7 次 AI 调用 · 今日剩余 43 次" });

    const lesson = screen.getByTestId("node-lesson");
    expect(lesson).toBeInTheDocument();
    expect(lesson).toHaveTextContent(zhDict["plans.nodeLessonAction"]);
    expect(lesson.getAttribute("aria-label")).toBe(zhDict["plans.nodeLessonAria"].replace("{node}", "Consensus"));
    expect(screen.getByTestId("node-lesson-hint")).toHaveTextContent("预计 5–7 次 AI 调用 · 今日剩余 43 次");

    await userEvent.click(lesson);
    expect(onLesson).toHaveBeenCalledExactlyOnceWith("n-1", "Consensus");
  });

  it("DISABLES the action on an UNMAPPED node with the honest reason always visible — the mapping dependency shown", () => {
    mount({ targets: [] });

    const lesson = screen.getByTestId("node-lesson");
    expect(lesson).toBeDisabled();
    expect(screen.getByTestId("node-lesson-hint")).toHaveTextContent(zhDict["plans.nodeLessonUnmapped"]);
    expect(onLesson).not.toHaveBeenCalled();
  });

  it("DISABLES while the mapping read is in flight or failed (no honest mapped/unmapped verdict yet)", () => {
    const inFlight = mount({ targets: null });
    expect(screen.getByTestId("node-lesson")).toBeDisabled();
    expect(screen.queryByTestId("node-lesson-hint")).not.toBeInTheDocument();
    inFlight.unmount();

    mount({ targets: null, failed: true });
    expect(screen.getByTestId("node-lesson")).toBeDisabled();
  });

  it("a disabled action never dispatches — nothing is generated from thin air", async () => {
    mount({ targets: [] });
    await userEvent.click(screen.getByTestId("node-lesson"));
    expect(onLesson).not.toHaveBeenCalled();
  });

  it("the node's EXISTING lesson deforms the action into 「打开讲义」 — enabled regardless of the mapping read", async () => {
    mount({ lessonMaterialId: "lesson-1" });

    const lesson = screen.getByTestId("node-lesson");
    expect(lesson).toHaveTextContent(zhDict["plans.nodeLessonOpen"]);
    expect(lesson).toBeEnabled();
    expect(screen.queryByTestId("node-lesson-hint")).not.toBeInTheDocument(); // an open action costs nothing new

    await userEvent.click(lesson);
    expect(onLesson).toHaveBeenCalledExactlyOnceWith("n-1", "Consensus");
  });

  it("the hint stays honest-empty while the estimate/cap reads load — never guessed numbers", () => {
    mount({ targets: [target], lessonHint: null });
    expect(screen.getByTestId("node-lesson")).toBeEnabled();
    expect(screen.queryByTestId("node-lesson-hint")).not.toBeInTheDocument();
  });
});

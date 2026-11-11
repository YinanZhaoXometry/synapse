/**
 * The hub row's lesson parts (epic-36 T3): MaterialLessonChips (origin +
 * generation-state) and MaterialLessonAction (the gate-disabled action, the
 * read-only outline confirm popover, the silent re-roll dispatch, the
 * create-dispatching confirm, and the lesson row's regenerate strong
 * confirm). userEvent-first. The state/gate derivations ride lesson-entry
 * (the pure module's own tests pin those); these tests pin the RENDER
 * contract.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { MaterialView } from "@/api/views";
import { MaterialLessonAction, MaterialLessonChips } from "./lesson-row-parts";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const onOpenChange = vi.fn();
const onConfirm = vi.fn();
const onReroll = vi.fn();
const onRegenerate = vi.fn();

const uploaded = (overrides: Partial<MaterialView> = {}): MaterialView => ({
  id: "m-1",
  title: "分布式笔记",
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [
    { id: "sec-1", title: "Raft 基础", text: "内容" },
    { id: "sec-2", title: "日志复制", text: "内容" },
  ],
  createdAt: "2026-11-12T00:00:00Z",
  downloadUrl: null,
  origin: "uploaded",
  generation: null,
  ...overrides,
});

const lessonRow = (overrides: Partial<MaterialView> = {}): MaterialView =>
  uploaded({
    id: "lesson-1",
    title: "共识协议讲义",
    parseState: "parsed",
    sections: [],
    origin: "generated",
    generation: {
      variant: "material",
      sourceMaterialIds: ["m-1"],
      outline: [
        { id: "ch-1", title: "第一章", anchors: [{ materialId: "m-1", sectionId: "sec-1" }], status: "ready" },
        { id: "ch-2", title: "第二章", anchors: [], status: "pending" },
      ],
      pausedKind: null,
      generatedAt: "2026-11-12T00:00:00Z",
    },
    ...overrides,
  });

const outline = [
  { title: "Raft 从零读起", sourceSectionIds: ["sec-1"] },
  { title: "复制与一致性", sourceSectionIds: ["sec-2"] },
];

function mountChips(material: MaterialView) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <MaterialLessonChips material={material} />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

function mountAction(material: MaterialView, overrides: Partial<Parameters<typeof MaterialLessonAction>[0]> = {}) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <MaterialLessonAction
          material={material}
          existingLessonId={null}
          gateReason={null}
          open={false}
          outline={null}
          proposing={false}
          outlineFailed={false}
          creating={false}
          costHint={null}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
          onReroll={onReroll}
          onRegenerate={onRegenerate}
          {...overrides}
        />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  onOpenChange.mockClear();
  onConfirm.mockClear();
  onReroll.mockClear();
  onRegenerate.mockClear();
});

describe("MaterialLessonChips — the origin + generation-state chips (story 15)", () => {
  it("renders nothing on an uploaded row", () => {
    mountChips(uploaded());
    expect(screen.queryByTestId("lesson-origin-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lesson-state-chip")).not.toBeInTheDocument();
  });

  it("renders the AI 讲义 chip + 进行中 while chapters are owed", () => {
    mountChips(lessonRow());
    expect(screen.getByTestId("lesson-origin-chip")).toHaveTextContent(zhDict["materials.lessonChip"]);
    expect(screen.getByTestId("lesson-state-chip")).toHaveTextContent(zhDict["materials.lessonStateActive"]);
  });

  it("renders 已暂停可续 for a paused lesson and no state chip for a complete one", () => {
    const paused = mountChips(lessonRow({ generation: { ...lessonRow().generation!, pausedKind: "cap" } }));
    expect(screen.getByTestId("lesson-state-chip")).toHaveTextContent(zhDict["materials.lessonStatePaused"]);
    paused.unmount();
    const complete = lessonRow();
    complete.generation!.outline[1].status = "ready";
    const done = mountChips(complete);
    expect(screen.queryByTestId("lesson-state-chip")).not.toBeInTheDocument();
    expect(screen.getByTestId("lesson-origin-chip")).toBeInTheDocument();
    done.unmount();
  });
});

describe("MaterialLessonAction — the row action (gate, deform, popover)", () => {
  it("renders 生成讲义 for an actionable uploaded row and opens the gate through the page", async () => {
    const user = userEvent.setup();
    mountAction(uploaded());
    const button = screen.getByTestId("material-lesson");
    expect(button).toHaveTextContent(zhDict["materials.lessonAction"]);
    await user.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("stops propagation on the action click (the row's own navigation never fires through it)", async () => {
    const user = userEvent.setup();
    mountAction(uploaded());
    const button = screen.getByTestId("material-lesson");
    const stopped = vi.fn();
    button.addEventListener("click", stopped); // Radix's toggle rides the same event
    await user.click(button);
    expect(stopped).toHaveBeenCalled();
  });

  it("renders disabled with the honest gate reason on the title (parsed ∧ sections gate)", () => {
    mountAction(uploaded({ parseState: "parsing" }), { gateReason: "parsing" });
    const button = screen.getByTestId("material-lesson");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", zhDict["materials.lessonGateParsing"]);
  });

  it("carries the failed and empty gate reasons too", () => {
    const { unmount } = mountAction(uploaded({ parseState: "failed" }), { gateReason: "failed" });
    expect(screen.getByTestId("material-lesson")).toHaveAttribute("title", zhDict["materials.lessonGateFailed"]);
    unmount();
    mountAction(uploaded({ sections: [] }), { gateReason: "empty" });
    expect(screen.getByTestId("material-lesson")).toHaveAttribute("title", zhDict["materials.lessonGateEmpty"]);
  });

  it("deforms into 打开讲义 when the source's lesson exists (repeat entry opens — story 11)", async () => {
    const user = userEvent.setup();
    mountAction(uploaded(), { existingLessonId: "lesson-1" });
    const button = screen.getByTestId("material-lesson");
    expect(button).toHaveTextContent(zhDict["materials.lessonOpen"]);
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("the open popover renders the outline READ-ONLY: chapters + source titles, no editor affordances", () => {
    mountAction(uploaded(), { open: true, outline, costHint: "预计 3 次 AI 调用 · 今日剩余 47 次" });
    const popover = screen.getByTestId("lesson-outline-confirm");
    expect(popover).toHaveTextContent(zhDict["materials.lessonOutlineTitle"]);
    expect(screen.getAllByTestId("lesson-outline-chapter")).toHaveLength(2);
    expect(screen.getAllByTestId("lesson-outline-chapter")[0]).toHaveTextContent("Raft 从零读起");
    // The chapter's source sections resolve OFF the material's rows (titles,
    // never raw ids when resolvable).
    expect(screen.getAllByTestId("lesson-outline-chapter-source")[0]).toHaveTextContent("Raft 基础");
    expect(screen.getAllByTestId("lesson-outline-chapter-source")[1]).toHaveTextContent("日志复制");
    // Read-only: no textbox / editable affordance anywhere in the gate.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("lesson-outline-cost")).toHaveTextContent("预计 3 次 AI 调用");
    expect(screen.getByTestId("lesson-outline-confirm-btn")).toHaveTextContent(zhDict["materials.lessonOutlineConfirm"]);
    expect(screen.getByTestId("lesson-outline-reroll")).toHaveTextContent(zhDict["materials.lessonOutlineReroll"]);
    expect(screen.getByTestId("lesson-outline-cancel")).toHaveTextContent(zhDict["materials.lessonOutlineCancel"]);
  });

  it("falls back to the raw section id when a source section no longer resolves (honest, never guessed)", () => {
    mountAction(uploaded({ sections: [] }), { open: true, outline: [{ title: "孤章", sourceSectionIds: ["sec-gone"] }] });
    expect(screen.getByTestId("lesson-outline-chapter-source")).toHaveTextContent("sec-gone");
  });

  it("取消 closes through the page (no dispatch), 确认生成 dispatches the echo", async () => {
    const user = userEvent.setup();
    mountAction(uploaded(), { open: true, outline });
    await user.click(screen.getByTestId("lesson-outline-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("lesson-outline-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onReroll).not.toHaveBeenCalled();
  });

  it("重出一版 dispatches a re-roll WITHOUT touching the confirm (one call, content replaced silently)", async () => {
    const user = userEvent.setup();
    mountAction(uploaded(), { open: true, outline });
    await user.click(screen.getByTestId("lesson-outline-reroll"));
    expect(onReroll).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("the proposing state renders the loading copy and hides the outline body", () => {
    mountAction(uploaded(), { open: true, outline, proposing: true });
    expect(screen.getByTestId("lesson-outline-loading")).toHaveTextContent(zhDict["materials.lessonOutlineProposing"]);
    expect(screen.queryByTestId("lesson-outline-confirm-btn")).not.toBeInTheDocument();
  });

  it("the failed state renders the honest failure + the retry-as-reroll posture", () => {
    mountAction(uploaded(), { open: true, outline: null, outlineFailed: true });
    expect(screen.getByTestId("lesson-outline-error")).toHaveTextContent(zhDict["materials.lessonOutlineFailed"]);
    expect(screen.getByTestId("lesson-outline-reroll")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-outline-confirm-btn")).not.toBeInTheDocument();
  });

  it("the empty-outline state renders the honest empty copy + re-roll (never a fake outline)", () => {
    mountAction(uploaded(), { open: true, outline: [] });
    expect(screen.getByTestId("lesson-outline-empty")).toHaveTextContent(zhDict["materials.lessonOutlineEmpty"]);
    expect(screen.queryByTestId("lesson-outline-confirm-btn")).not.toBeInTheDocument();
  });

  it("the creating state disables the confirm and names itself (one commit per click)", () => {
    mountAction(uploaded(), { open: true, outline, creating: true });
    const confirm = screen.getByTestId("lesson-outline-confirm-btn");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent(zhDict["materials.lessonOutlineCreating"]);
  });

  it("a lesson row renders 打开讲义 + the regenerate entry (the material-side 重新生成)", async () => {
    const user = userEvent.setup();
    mountAction(lessonRow());
    expect(screen.getByTestId("material-lesson")).toHaveTextContent(zhDict["materials.lessonOpen"]);
    await user.click(screen.getByTestId("material-lesson-regen"));
    // The strong confirm (原位替换 + 重烧) — the reader's exact copy keys.
    expect(screen.getByTestId("lesson-regenerate-dialog")).toBeInTheDocument();
    expect(screen.getByText(zhDict["reader.lessonRegenerateBody"])).toBeInTheDocument();
    await user.click(screen.getByTestId("lesson-regenerate-cancel"));
    expect(onRegenerate).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("material-lesson-regen"));
    await user.click(screen.getByTestId("lesson-regenerate-confirm"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});

/**
 * LessonFlow (epic-36 T2): the reader's lesson state — outline placeholder
 * cards (pending gray / generating live / ready prose through the SAME
 * MarkdownView the ordinary reader renders), the top pause banner (cap vs
 * provider copy), the 继续/重新生成 actions (regenerate carries the strong
 * confirm), and the section-end source lines. userEvent-first. The banner
 * state + progress derive through lesson-display (the pure module's own
 * tests pin those derivations; these tests pin the RENDER contract).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { LessonGenerationView, MaterialView } from "@/api/views";
import type { MaterialSection } from "@/domain/entities";
import { lessonRows } from "./lesson-display";
import LessonFlow from "./lesson-flow";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const onResume = vi.fn();
const onRegenerate = vi.fn();

const material = (overrides: Partial<MaterialView> = {}): MaterialView => ({
  id: "lesson-1",
  title: "共识协议",
  kind: "markdown",
  sizeBytes: 0,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "node",
  nodeId: "n-1",
  parseState: "parsed",
  sections: [],
  createdAt: "2026-11-12T00:00:00Z",
  downloadUrl: null,
  origin: "generated",
  generation: null,
  ...overrides,
});

const generation = (overrides: Partial<LessonGenerationView> = {}): LessonGenerationView => ({
  variant: "node",
  sourceMaterialIds: ["src-1"],
  outline: [
    { id: "ch-1", title: "选举与日志", anchors: [{ materialId: "src-1", sectionId: "sec-1" }], status: "pending" },
    { id: "ch-2", title: "链式复制", anchors: [], status: "pending" },
  ],
  pausedKind: null,
  generatedAt: "2026-11-12T00:00:00Z",
  ...overrides,
});

const sectionRows = (): MaterialSection[] => [
  { id: "ch-1", title: "选举与日志", text: "# 选举与日志\n\n领导者选举是 Raft 的第一步。" },
];

const makeSourceMaterials = (): MaterialView[] => [
  {
    id: "src-1",
    title: "分布式笔记",
    kind: "markdown",
    sizeBytes: 1,
    planId: "plan-1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    sections: [{ id: "sec-1", title: "Raft", text: "x" }],
    createdAt: "2026-11-12T00:00:00Z",
    downloadUrl: null,
    origin: "uploaded",
    generation: null,
  },
];

function mount({
  gen = generation(),
  sections = [],
  streaming = false,
  activeSectionId = null,
  streamText = null,
  sourceMaterials = makeSourceMaterials(),
}: {
  gen?: LessonGenerationView;
  sections?: MaterialSection[];
  streaming?: boolean;
  activeSectionId?: string | null;
  streamText?: string | null;
  sourceMaterials?: MaterialView[] | null;
} = {}) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <LessonFlow
          material={material({ generation: gen, sections })}
          rows={lessonRows(gen, sections, { activeSectionId, streamText })}
          streaming={streaming}
          activeSectionId={activeSectionId}
          streamText={streamText}
          sourceMaterials={sourceMaterials ?? undefined}
          onResume={onResume}
          onRegenerate={onRegenerate}
        />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  onResume.mockClear();
  onRegenerate.mockClear();
});

describe("LessonFlow — the placeholder cards (reader 即进度面)", () => {
  it("pending chapters render gray placeholders with the 待生成 label + their titles", () => {
    mount();

    const placeholders = screen.getAllByTestId("lesson-placeholder");
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).toHaveTextContent("选举与日志");
    expect(placeholders[0]).toHaveTextContent(zhDict["reader.lessonPendingLabel"]);
  });

  it("the ACTIVE chapter renders the live fragment with the generating label (the lesson assembles in front of you)", () => {
    mount({ streaming: true, activeSectionId: "ch-2", streamText: "链式复制把写" });

    const live = screen.getByTestId("lesson-placeholder-active");
    expect(live).toHaveTextContent("链式复制");
    expect(live).toHaveTextContent("链式复制把写");
    expect(screen.getByTestId("lesson-pause-banner")).toHaveTextContent(
      zhDict["reader.lessonLiveSection"].replace("{title}", "链式复制"),
    );
    expect(screen.getByTestId("lesson-pause-banner")).toHaveTextContent(
      zhDict["reader.lessonProgress"].replace("{ready}", "0").replace("{total}", "2"),
    );
  });

  it("READY chapters render the prose through the markdown pipeline — the real section heading ids", async () => {
    mount({
      gen: generation({ outline: generation().outline.map((c, i) => ({ ...c, status: i === 0 ? "ready" : "pending" })) }),
      sections: sectionRows(),
    });

    const ready = await screen.findByTestId("lesson-section-ready");
    await waitFor(() => expect(ready).toHaveTextContent("领导者选举是 Raft 的第一步。"));
    await waitFor(() => expect(ready.querySelector("h1#选举与日志")).not.toBeNull());
  });
});

describe("LessonFlow — the pause banner (cap/provider 两态 + 继续/重新生成)", () => {
  it("cap pause shows the 明日续 copy + 继续 (the pause is never a loss)", async () => {
    mount({ gen: generation({ pausedKind: "cap" }) });

    const banner = screen.getByTestId("lesson-pause-banner");
    expect(banner).toHaveTextContent(zhDict["reader.lessonPausedCap"]);
    expect(screen.getByTestId("lesson-resume")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("lesson-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("provider pause shows the service copy + 继续", async () => {
    mount({ gen: generation({ pausedKind: "provider" }), streaming: false });

    expect(screen.getByTestId("lesson-pause-banner")).toHaveTextContent(zhDict["reader.lessonPausedProvider"]);
    await userEvent.click(screen.getByTestId("lesson-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("the incomplete posture (a returned-to lesson, no pause) offers the honest 继续", async () => {
    mount({ gen: generation(), streaming: false });

    expect(screen.getByTestId("lesson-pause-banner")).toHaveTextContent(
      zhDict["reader.lessonIncomplete"].replace("{n}", "2"),
    );
    await userEvent.click(screen.getByTestId("lesson-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("a complete lesson renders NO banner — nothing to continue", () => {
    const done = generation({ outline: generation().outline.map((c) => ({ ...c, status: "ready" })) });
    mount({ gen: done, sections: [...sectionRows(), { id: "ch-2", title: "链式复制", text: "正文" }] });

    expect(screen.queryByTestId("lesson-pause-banner")).not.toBeInTheDocument();
  });

  it("重新生成 carries the strong confirm — the confirm fires onRegenerate, cancel does not", async () => {
    mount({ gen: generation({ pausedKind: "cap" }) });

    await userEvent.click(screen.getByTestId("lesson-regenerate"));
    const confirm = screen.getByTestId("lesson-regenerate-confirm");
    expect(confirm).toBeInTheDocument();
    expect(screen.getByTestId("lesson-regenerate-dialog")).toHaveTextContent(zhDict["reader.lessonRegenerateBody"]);

    await userEvent.click(screen.getByTestId("lesson-regenerate-cancel"));
    expect(onRegenerate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("lesson-regenerate"));
    await userEvent.click(screen.getByTestId("lesson-regenerate-confirm"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});

describe("LessonFlow — the section-end source lines (溯源与诚实)", () => {
  it("a ready section renders its source line: 《材料名》· §title, clicking jumps to the original reader", async () => {
    mount({
      gen: generation({ outline: generation().outline.map((c, i) => ({ ...c, status: i === 0 ? "ready" : "pending" })) }),
      sections: sectionRows(),
    });

    const line = await screen.findByTestId("lesson-source-link");
    expect(line).toHaveTextContent("《分布式笔记》· §Raft");
    expect(line.getAttribute("href")).toBe("/read/src-1?hl=1#sec-1");
  });

  it("a deleted source renders the honest gap text — no link, no guessed name", async () => {
    mount({
      gen: generation({ outline: generation().outline.map((c, i) => ({ ...c, status: i === 0 ? "ready" : "pending" })) }),
      sections: sectionRows(),
      sourceMaterials: [],
    });

    await waitFor(() => expect(screen.getByTestId("lesson-source-missing")).toBeInTheDocument());
    expect(screen.queryByTestId("lesson-source-link")).not.toBeInTheDocument();
  });

  it("no anchors (the whole chapter unanchored) renders no source line", async () => {
    mount({
      gen: generation({
        outline: [{ id: "ch-1", title: "无锚章节", anchors: [], status: "ready" }, generation().outline[1]],
      }),
      sections: sectionRows(),
    });

    await waitFor(() => expect(screen.getByTestId("lesson-section-ready")).toBeInTheDocument());
    expect(screen.queryByTestId("lesson-source-link")).not.toBeInTheDocument();
  });
});

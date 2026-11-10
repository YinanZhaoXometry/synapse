/**
 * CompanionPanel — the quiz thread (epic-24 T4): the 考考我 chip sends, the
 * reply's ```synapse-quiz fence renders as an INTERACTIVE block (choice or
 * short), NFR-8 holds (nothing about the answer pre-submit), the verdict +
 * correct answer + explanation reveal post-submit, the chips stay visible
 * after a completed turn (the always-visible rule), and a streaming quiz
 * reply never flashes its raw JSON. The seam is injected
 * (setCompanionService); Apollo persistence is mocked at the module boundary
 * (the selection-thread test's pattern).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import { formatQuizFence, QUIZ_FENCE_MARKER, type CompanionQuiz } from "@/ai/quiz";
import type { CompanionReply, GroundedChatRequest } from "@/ai/types";
import type { Material, ReadingLocator, ReadingPosition } from "@/domain/entities";
import { CompanionPanel } from "./CompanionPanel";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const appendMutate = vi.hoisted(() => vi.fn());

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    useChatThreadQuery: () => ({ data: undefined, loading: false, error: null, refetch: vi.fn() }),
    useAppendChatMessageMutation: () => ({ mutate: appendMutate, result: null }),
  };
});

const material: Material = {
  id: "mat-1",
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [{ id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" }],
  createdAt: "2026-11-01T00:00:00Z",
};

const locator: ReadingLocator = { kind: "markdown", sectionId: "sec-1" };
const position: ReadingPosition = { locator, text: "集成测试关注组件之间的交互。" };

const CHOICE_QUIZ: CompanionQuiz = {
  kind: "choice",
  question: "____ 关注组件之间的交互。",
  options: ["单元测试", "集成测试", "冒烟测试", "回归测试"],
  answer: 1,
  explanation: "材料原句：集成测试关注组件之间的交互。",
};

const SHORT_QUIZ: CompanionQuiz = {
  kind: "short",
  question: "用自己的话说说：集成测试关注什么？",
  answerText: "集成测试关注组件之间的交互。",
  keywords: ["组件", "交互"],
  explanation: "对照原句即可。",
};

/** A service whose single chat reply resolves immediately; the streamed
 * tokens ride through `onStream` when the test wants to drive the stream. */
function serviceReplyingWith(
  reply: CompanionReply,
  onStream?: (onToken: (chunk: string) => void) => void,
): CompanionService {
  return {
    chat: (_request: GroundedChatRequest, onToken) => {
      onStream?.((chunk) => onToken?.(chunk));
      return Promise.resolve(reply);
    },
    planChat: vi.fn(),
    generatePlanStructure: vi.fn(),
    generateQuiz: vi.fn(),
    generateFlashcards: vi.fn(),
    gradeOpenAnswer: vi.fn(),
  };
}

function replyWithQuiz(quiz: CompanionQuiz): CompanionReply {
  return {
    intent: "quiz-me",
    rung: "hint",
    text: `好，考你一题：\n\n${formatQuizFence(quiz)}`,
    citations: [{ locator, quote: "集成测试关注组件之间的交互。" }],
    canEscalate: true,
    language: "zh",
  };
}

function renderPanel() {
  return render(
    <LanguageProvider>
      <div className="h-[480px]">
        <CompanionPanel
          materialId="mat-1"
          material={material}
          positionRef={{ current: position }}
          displayLocator={locator}
          onJumpToLocator={() => undefined}
        />
      </div>
    </LanguageProvider>,
  );
}

async function askQuizMe() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: zhDict["companion.starterQuiz"] }));
  await waitFor(() => {
    expect(screen.getByTestId("companion-quiz-block")).not.toBeNull();
  });
  return user;
}

beforeEach(() => {
  appendMutate.mockReset();
});

afterEach(() => {
  setCompanionService(null);
});

describe("CompanionPanel — the quiz thread (epic-24 T4)", () => {
  it("考考我 renders an interactive CHOICE block; NFR-8: no answer pre-submit", async () => {
    setCompanionService(serviceReplyingWith(replyWithQuiz(CHOICE_QUIZ)));
    renderPanel();
    const user = await askQuizMe();

    // NFR-8: the verdict, the correct answer, the explanation — none exist pre-submit
    expect(screen.queryByTestId("quiz-block-verdict")).toBeNull();
    expect(screen.queryByText(CHOICE_QUIZ.explanation!)).toBeNull();
    expect(screen.queryByText(/正确答案/)).toBeNull();

    // submit is gated on a selection
    expect(screen.getByTestId("quiz-block-submit")).toBeDisabled();
    await user.click(screen.getByTestId("quiz-block-option-1"));
    await user.click(screen.getByTestId("quiz-block-submit"));

    const verdict = screen.getByTestId("quiz-block-verdict");
    expect(verdict).toHaveTextContent(zhDict["companion.quizCorrect"]);
    expect(screen.getByText(CHOICE_QUIZ.explanation!)).not.toBeNull();
    expect(screen.getByText(/正确答案/)).not.toBeNull();
    // the block locks post-submit
    expect(screen.getByTestId("quiz-block-option-2")).toBeDisabled();
  });

  it("a wrong pick shows the wrong verdict AND reveals the correct option", async () => {
    setCompanionService(serviceReplyingWith(replyWithQuiz(CHOICE_QUIZ)));
    renderPanel();
    const user = await askQuizMe();

    await user.click(screen.getByTestId("quiz-block-option-0"));
    await user.click(screen.getByTestId("quiz-block-submit"));

    expect(screen.getByTestId("quiz-block-verdict")).toHaveTextContent(zhDict["companion.quizWrong"]);
    // the correct option reveals with its label
    expect(screen.getByTestId("quiz-block-option-1").textContent).toContain("集成测试");
  });

  it("a SHORT block grades by keyword hits — the hit path reads correct", async () => {
    setCompanionService(serviceReplyingWith(replyWithQuiz(SHORT_QUIZ)));
    renderPanel();
    const user = await askQuizMe();

    const input = screen.getByTestId("quiz-block-short-input") as HTMLTextAreaElement;
    expect(screen.queryByText(/参考答案/)).toBeNull(); // NFR-8 pre-submit
    await user.type(input, "它检查不同组件之间的交互是否正确");
    await user.click(screen.getByTestId("quiz-block-submit"));
    expect(screen.getByTestId("quiz-block-verdict")).toHaveTextContent(zhDict["companion.quizCorrect"]);
    expect(screen.getByText(/参考答案/)).not.toBeNull();
  });

  it("a short answer missing every keyword never claims correct — it points at the reference", async () => {
    setCompanionService(serviceReplyingWith(replyWithQuiz(SHORT_QUIZ)));
    renderPanel();
    const user = await askQuizMe();

    await user.type(screen.getByTestId("quiz-block-short-input"), "完全无关的回答");
    await user.click(screen.getByTestId("quiz-block-submit"));
    expect(screen.getByTestId("quiz-block-verdict")).toHaveTextContent("0/2");
    // the miss copy AND the reference label both name 参考答案 — assert presence
    expect(screen.getAllByText(/参考答案/).length).toBeGreaterThanOrEqual(1);
  });

  it("the starter chips stay visible after a completed turn (the always-visible rule)", async () => {
    setCompanionService(serviceReplyingWith(replyWithQuiz(CHOICE_QUIZ)));
    renderPanel();
    await askQuizMe();
    expect(screen.getByRole("button", { name: zhDict["companion.starterQuiz"] })).not.toBeNull();
    expect(screen.getByRole("button", { name: zhDict["companion.starterExplain"] })).not.toBeNull();
  });

  it("a streaming quiz reply hides its raw JSON — the 出题中 line shows instead", async () => {
    let resolveChat: ((reply: CompanionReply) => void) | null = null;
    const service: CompanionService = {
      chat: (_request: GroundedChatRequest, onToken) =>
        new Promise<CompanionReply>((resolve) => {
          resolveChat = resolve;
          onToken?.("好，考你一题：\n\n");
          onToken?.(formatQuizFence(CHOICE_QUIZ).slice(0, 24));
        }),
      planChat: vi.fn(),
      generatePlanStructure: vi.fn(),
      generateQuiz: vi.fn(),
      generateFlashcards: vi.fn(),
      gradeOpenAnswer: vi.fn(),
    };
    setCompanionService(service);
    renderPanel();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: zhDict["companion.starterQuiz"] }));

    await waitFor(() => expect(screen.getByTestId("companion-quiz-generating")).not.toBeNull());
    expect(screen.queryByText(new RegExp(CHOICE_QUIZ.options[0]!))).toBeNull(); // no payload flash
    expect(screen.queryByText(QUIZ_FENCE_MARKER)).toBeNull();

    resolveChat?.(replyWithQuiz(CHOICE_QUIZ));
    await waitFor(() => expect(screen.getByTestId("companion-quiz-block")).not.toBeNull());
    expect(screen.queryByTestId("companion-quiz-generating")).toBeNull();
  });

  it("a drift reply whose payload arrives BARE (no fence) still renders the interactive block", async () => {
    // The owner's 2026-11-10 report: the live model dropped the fence and the
    // raw JSON rode the reply tail as visible text.
    const bare = `好，考你一题：\n\n${JSON.stringify(CHOICE_QUIZ)}`;
    setCompanionService(
      serviceReplyingWith({ ...replyWithQuiz(CHOICE_QUIZ), text: bare }),
    );
    renderPanel();
    const user = await askQuizMe();

    // the payload never shows as raw text — the lead prose does, the block mounts
    expect(screen.queryByText(/"kind"/)).toBeNull();
    expect(screen.getByTestId("companion-quiz-block")).not.toBeNull();
    expect(screen.getByText("好，考你一题：")).not.toBeNull();

    // and the salvaged block is fully interactive
    await user.click(screen.getByTestId("quiz-block-option-1"));
    await user.click(screen.getByTestId("quiz-block-submit"));
    expect(screen.getByTestId("quiz-block-verdict")).toHaveTextContent(zhDict["companion.quizCorrect"]);
  });

  it("a drift reply streams bare JSON without flashing it — 出题中 shows instead", async () => {
    const bareFence = `好，考你一题：\n\n${JSON.stringify(CHOICE_QUIZ)}`;
    let resolveChat: ((reply: CompanionReply) => void) | null = null;
    const service: CompanionService = {
      chat: (_request: GroundedChatRequest, onToken) =>
        new Promise<CompanionReply>((resolve) => {
          resolveChat = resolve;
          onToken?.(bareFence.slice(0, 30)); // mid-payload snapshot
        }),
      planChat: vi.fn(),
      generatePlanStructure: vi.fn(),
      generateQuiz: vi.fn(),
      generateFlashcards: vi.fn(),
      gradeOpenAnswer: vi.fn(),
    };
    setCompanionService(service);
    renderPanel();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: zhDict["companion.starterQuiz"] }));

    await waitFor(() => expect(screen.getByTestId("companion-quiz-generating")).not.toBeNull());
    expect(screen.queryByText(new RegExp(CHOICE_QUIZ.options[0]!))).toBeNull(); // no payload flash
    expect(screen.queryByText(/"kind"/)).toBeNull();

    resolveChat?.({ ...replyWithQuiz(CHOICE_QUIZ), text: bareFence });
    await waitFor(() => expect(screen.getByTestId("companion-quiz-block")).not.toBeNull());
  });
});

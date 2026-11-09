/**
 * CompanionPanel copy affordance (epic-26 T2) — deterministic, offline, the
 * plan-mode test's harness pattern. Pinned: the user bubble and the completed
 * Companion bubble each carry a hover-revealed copy button writing the RAW
 * text (the user's entry.text; the Companion's rendered lead without the quiz
 * fence), the streaming bubble carries none, and markdown in the reply
 * renders as elements (the lead is no longer a bare pre-wrap paragraph).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import { formatQuizFence } from "@/ai/quiz";
import type { CompanionQuiz } from "@/ai/quiz";
import type { CompanionReply } from "@/ai/types";
import { CompanionPanel } from "./CompanionPanel";

const appendMutate = vi.hoisted(() => vi.fn());

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    usePlanChatThreadQuery: () => ({ data: undefined, loading: false, error: null, refetch: vi.fn() }),
    useAppendPlanChatMessageMutation: () => ({ mutate: appendMutate, result: null }),
  };
});

let fixtureReply: CompanionReply;
// The streaming window's hold: when set, planChat's resolution waits for the
// test (the mid-stream assertions get a stable window, not a race).
let holdReply: (() => void) | null = null;

const stubService = (): CompanionService => ({
  chat: vi.fn(),
  planChat: (_request, onToken) => {
    onToken?.(fixtureReply.text.slice(0, 2));
    if (holdReply) {
      return new Promise<typeof fixtureReply>((resolve) => {
        holdReply = () => resolve(fixtureReply);
      });
    }
    return Promise.resolve(fixtureReply);
  },
  generatePlanStructure: vi.fn(),
  generateQuiz: vi.fn(),
  generateFlashcards: vi.fn(),
  gradeOpenAnswer: vi.fn(),
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <div className="h-[480px]">
          <CompanionPanel mode="plan" planId="plan-1" materials={[]} mistakeEntries={[]} />
        </div>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

describe("CompanionPanel — copy affordance (epic-26 T2)", () => {
  beforeEach(() => {
    fixtureReply = {
      intent: "explain",
      rung: "answer",
      text: "集成测试关注**组件之间**的交互。",
      citations: [],
      canEscalate: false,
      language: "zh",
    };
    holdReply = null;
    setCompanionService(stubService());
  });

  afterEach(() => {
    setCompanionService(null);
  });

  it("the completed Companion bubble renders markdown and copies the raw lead", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const view = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: zh("tutor.suggestExplain") }));
    // markdown rendering: the **组件之间** span is a real <strong>, not raw syntax
    const strong = await screen.findByText("组件之间");
    expect(strong.tagName).toBe("STRONG");

    const copyButton = view.container.querySelector('[data-testid="chat-copy-companion"]')!;
    await user.hover(copyButton);
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith("集成测试关注**组件之间**的交互。");
  });

  it("the user bubble carries its own copy writing the user's raw text", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const view = renderPanel();

    const composer = screen.getByRole("textbox");
    await user.type(composer, "什么是集成测试？{Enter}");
    await screen.findByText("组件之间");

    const copyButton = view.container.querySelector('[data-testid="chat-copy-user"]')!;
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith("什么是集成测试？");
  });

  it("the streaming bubble carries no copy — the completed one does", async () => {
    const user = userEvent.setup();
    const view = renderPanel();
    holdReply = () => {};

    const composer = screen.getByRole("textbox");
    await user.type(composer, "解释一下{Enter}");
    // held mid-stream (the stub fired one token 「集成」): the streaming row is
    // up and carries NO copy button
    await screen.findByText("集成");
    expect(view.container.querySelector('[data-testid="chat-copy-companion"]')).toBeNull();

    holdReply?.();
    holdReply = null;
    await screen.findByText("组件之间");
    expect(view.container.querySelector('[data-testid="chat-copy-companion"]')).not.toBeNull();
  });

  it("a quiz-fence reply copies only the lead — the fence JSON never rides", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const quiz: CompanionQuiz = {
      kind: "choice",
      question: "____ 关注组件之间的交互。",
      options: ["单元测试", "集成测试", "冒烟测试", "回归测试"],
      answer: 1,
      explanation: "材料原句。",
    };
    fixtureReply = { ...fixtureReply, text: `先答题。\n${formatQuizFence(quiz)}` };
    const view = renderPanel();

    const composer = screen.getByRole("textbox");
    await user.type(composer, "考考我{Enter}");
    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="companion-quiz-block"]')).not.toBeNull();
    });

    const copyButton = view.container.querySelector('[data-testid="chat-copy-companion"]')!;
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith("先答题。");
  });
});

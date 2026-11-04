import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { CreateQuizSessionDocument } from "@/types/graphql";
import type { Material, MaterialSection } from "@/domain/entities";
import { echoQuestion } from "@/test/apollo-harness";
import { QuizLauncher } from "./QuizLauncher";

/**
 * QuizLauncher observable states (T2; spec testing seam 3 — component render
 * seam over the real driver + the simulated AI): no-quizable-materials
 * disabled with its reason, the mode/scope form, generating cancellable with
 * NO session created on cancel, and generation failure as a neutral toast
 * with the form intact for retry (plan state untouched, no session — spec
 * story 8). Expected copy reads the copy deck directly, never recomputed.
 * Since the Apollo cutover (epic P2-8) the driver persists through the
 * CreateQuizSession mutation: the mock echoes the generated questions back
 * as a server-shaped payload and CAPTURES the request — the old store
 * assertions now read the captured mutations.
 */

// The failure switch: one seam override — generateQuiz rejects while failed,
// every other call delegates to the real simulated adapter.
const failState = { fail: false };
vi.mock("@/ai/companion-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/companion-service")>();
  const real = actual.getCompanionService();
  return {
    ...actual,
    getCompanionService: () => ({
      chat: (...args: Parameters<typeof real.chat>) => real.chat(...args),
      generatePlanStructure: (...args: Parameters<typeof real.generatePlanStructure>) => real.generatePlanStructure(...args),
      generateQuiz: async (input: Parameters<typeof real.generateQuiz>[0]) => {
        if (failState.fail) throw new Error("simulated outage");
        return real.generateQuiz(input);
      },
      generateFlashcards: (...args: Parameters<typeof real.generateFlashcards>) => real.generateFlashcards(...args),
      gradeOpenAnswer: (...args: Parameters<typeof real.gradeOpenAnswer>) => real.gradeOpenAnswer(...args),
    }),
  };
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

/** The launcher's material prop is a domain entity (the feature seam) — a plain fixture. */
const materialFixture = (id: string): Material =>
  ({
    id,
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: "plan-1",
    taskId: null,
    parseState: "parsed",
    parseFailureReason: null,
    sections,
    createdAt: "2026-11-01T00:00:00Z",
  }) as unknown as Material;

const PLAN_ID = "plan-1";
const NODE_IDS = ["n-1"];

/** Every CreateQuizSession the driver fires: the captured request + echoed row. */
let createdSessions: Array<{ input: Record<string, unknown>; session: Record<string, unknown> }>;

/** The echo mock: derives the persisted session + questions from ONE call's variables. */
const createQuizSessionMock = {
  request: {
    query: CreateQuizSessionDocument,
    variables: (variables: Record<string, unknown>) => !!variables?.input,
  },
  result: (variables: Record<string, unknown>) => {
    const input = variables.input as Record<string, unknown>;
    const sessionId = `s-echo-${createdSessions.length + 1}`;
    const session = {
      __typename: "QuizSession",
      id: sessionId,
      planId: input.planId ?? null,
      taskId: input.taskId ?? null,
      mode: input.mode,
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
      completedAt: null,
    };
    const questions = (input.questions as Array<Record<string, unknown>>).map((q, i) => echoQuestion(q, sessionId, i));
    createdSessions.push({ input, session });
    return { data: { createQuizSession: { __typename: "CreateSessionPayload", session, questions } } };
  },
  maxUsageCount: 10,
};

function renderLauncher(props: Partial<Parameters<typeof QuizLauncher>[0]> = {}) {
  const material = materialFixture("m-1");
  const onStarted = vi.fn();
  render(
    <LanguageProvider>
      <MockedProvider mocks={[createQuizSessionMock]}>
        <MemoryRouter>
          <Toaster />
          <QuizLauncher
            planId={PLAN_ID}
            nodeIds={NODE_IDS}
            materials={props.materials ?? [material]}
            onStarted={onStarted}
            {...props}
          />
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
  return { onStarted, material };
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  failState.fail = false;
  createdSessions = [];
});

describe("QuizLauncher (FR-18; UX spine QuizLauncher contract)", () => {
  it("no quizable materials: disabled state with the bilingual reason, no start affordance", () => {
    renderLauncher({ materials: [] });
    expect(screen.getByTestId("quiz-launcher-disabled")).toBeInTheDocument();
    expect(screen.getByText(zh("quiz.launcher.needMaterial"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-launcher-start")).not.toBeInTheDocument();
    expect(createdSessions).toHaveLength(0); // nothing to launch from → no session, ever
  });

  it("form: the three modes + whole-plan and per-material scopes are offered; mix is the default", () => {
    const { material } = renderLauncher();
    expect(screen.getByTestId("quiz-mode-open")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("quiz-mode-choice")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("quiz-mode-mix")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("quiz-scope-plan")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId(`quiz-scope-${material.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quiz-mode-choice"));
    expect(screen.getByTestId("quiz-mode-choice")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("quiz-mode-mix")).toHaveAttribute("aria-checked", "false");
  });

  it("generating shows 「来自 N 份材料 · 正在出题」 and cancel creates NO session, returning to the form", async () => {
    renderLauncher();
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByTestId("quiz-launcher-generating")).toBeInTheDocument();
    expect(screen.getByText(zhN("quiz.launcher.generating", 1))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quiz-launcher-cancel"));
    expect(screen.getByTestId("quiz-launcher")).toBeInTheDocument(); // form is back

    await flush(800); // longer than the simulated 600ms beat — nothing may land
    expect(createdSessions).toHaveLength(0); // cancel = no session, ever
    expect(screen.getByTestId("quiz-launcher-start")).toBeInTheDocument();
  });

  it("generation failure: neutral toast, no session created, the form stays for a retry that succeeds", async () => {
    const { onStarted } = renderLauncher();
    failState.fail = true;
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zh("quiz.launcher.failed"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-launcher-generating")).not.toBeInTheDocument();
    await flush(800);
    expect(createdSessions).toHaveLength(0); // plan state untouched, no session

    failState.fail = false; // the retry
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const [sessionId] = onStarted.mock.calls[0];
    expect(createdSessions).toHaveLength(1); // exactly one persisted session
    expect(createdSessions[0].session.id).toBe(sessionId);
    expect(createdSessions[0].session.status).toBe("active");
  });

  it("success hands the persisted session id + the exact start input to the surface", async () => {
    const { onStarted } = renderLauncher();
    fireEvent.click(screen.getByTestId("quiz-mode-choice")); // a real param choice
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const [sessionId, input] = onStarted.mock.calls[0];
    expect(typeof sessionId).toBe("string");
    expect(input.mode).toBe("choice");
    expect(input.materials).toHaveLength(1);
    expect(input.planId).toBeTruthy();
    expect(createdSessions[0].session.mode).toBe("choice"); // the persisted row carries the chosen mode
    expect(createdSessions[0].input.planId).toBe(PLAN_ID); // AD-6 ownership rides the mutation
    expect(createdSessions[0].input.questions).toHaveLength(2); // one choice per section
  });
});

function zhN(key: string, n: number) {
  return zh(key).replace("{n}", String(n));
}

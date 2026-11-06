import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AbandonQuizSessionDocument,
  AllEvidenceDocument,
  CreateQuizSessionDocument,
  MaterialsDocument,
  QuizSessionDocument,
  TaskDocument,
} from "@/types/graphql";
import { QUIZ_FRESH_LAUNCH_KEY } from "@/features/quiz";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { echoQuestion } from "@/test/apollo-harness";
import TaskQuizPage from "./TaskQuizPage";

/**
 * TaskQuizPage observable states (T4; spec testing seam 3 — the LEAN
 * context-routing suite over MockedProvider, the cutover's Apollo test seam):
 * the task page wires the shared QuizSessionPage shell to the task's context.
 * Full runner/launcher/results behavior is already covered by the plan twin's
 * suite (T2 — same components, same shell); these tests assert only what is
 * task-scoped: the honest not-found, the inline launcher's task shape (mode
 * select, NO scope picker — the single material IS the scope), back targets
 * (Task Home / Plans Home), and AD-6 session ownership (a plan-owned session
 * id never runs on the task route; a task-owned one resumes). Mock data is
 * server-shaped (fixtures off the generated fragment types, `__typename`
 * everywhere an id lives). Expected copy reads the copy deck directly.
 */

// The recording seam (the PlanQuizPage suite's precedent): generateQuiz inputs
// are captured so the launch asserts read the EXACT seam input the driver
// sent — the targeting-refusal pin's observation point (a task launch must
// carry NO targeting even with ?nodeId in the URL).
const generatedQuizInputs: Array<Record<string, unknown>> = [];
vi.mock("@/ai/companion-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/companion-service")>();
  const real = actual.getCompanionService();
  return {
    ...actual,
    getCompanionService: () => ({
      chat: (...args: Parameters<typeof real.chat>) => real.chat(...args),
      generatePlanStructure: (...args: Parameters<typeof real.generatePlanStructure>) => real.generatePlanStructure(...args),
      generateQuiz: async (input: Parameters<typeof real.generateQuiz>[0]) => {
        generatedQuizInputs.push(input);
        return real.generateQuiz(input);
      },
      generateFlashcards: (...args: Parameters<typeof real.generateFlashcards>) => real.generateFlashcards(...args),
      gradeOpenAnswer: (...args: Parameters<typeof real.gradeOpenAnswer>) => real.gradeOpenAnswer(...args),
    }),
  };
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const TASK_ID = "t-1";
const MATERIAL_ID = "m-1";
const NODE_ID = "n-1";
const SESSION_ID = "s-1";

const serverNode = {
  __typename: "KnowledgeNode",
  id: NODE_ID,
  planId: null,
  taskId: TASK_ID,
  stage: null,
  title: "lecture-04",
  description: null,
  optional: false,
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  createdAt: "2026-11-01T00:00:00Z",
};

const serverTask = {
  __typename: "StudyTask",
  id: TASK_ID,
  materialId: MATERIAL_ID,
  nodeId: NODE_ID,
  createdAt: "2026-11-01T00:00:00Z",
  node: serverNode,
};

const serverMaterial = {
  __typename: "Material",
  id: MATERIAL_ID,
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 64,
  planId: null,
  taskId: TASK_ID,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: "2026-11-01T00:00:00Z",
  downloadUrl: null,
  sections: [
    { __typename: "MaterialSection", id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
    { __typename: "MaterialSection", id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
  ],
};

const serverQuestion = (id: string, prompt: string, correct: number, sectionId: string) => ({
  __typename: "Question",
  id,
  sessionId: SESSION_ID,
  nodeId: NODE_ID,
  kind: "choice",
  prompt,
  options: ["right", "wrong"],
  correctOptionIndex: correct,
  sourceMaterialId: MATERIAL_ID,
  sourceSectionId: sectionId,
  keywords: null,
  explanation: "because",
});

const serverSession = (owner: { planId: string | null; taskId: string | null }) => ({
  __typename: "QuizSession",
  id: SESSION_ID,
  planId: owner.planId,
  taskId: owner.taskId,
  mode: "choice",
  status: "active",
  createdAt: "2026-11-01T00:00:00Z",
  completedAt: null,
  questions: [
    serverQuestion("q-1", "Choice one", 0, "sec-1"),
    serverQuestion("q-2", "Choice two", 1, "sec-2"),
  ],
});

function pageMocks(options: { session?: Record<string, unknown> | null } = {}) {
  const { session = null } = options;
  const mocks: MockedResponse[] = [
    // useTaskQuery AND useTaskNodeQuery both watch the Task document; an
    // unknown route id reads as server null (the honest not-found path)
    {
      request: {
        query: TaskDocument,
        variables: () => true,
      },
      result: (vars) => ({ data: { task: vars.id === TASK_ID ? serverTask : null } }),
      maxUsageCount: 4,
    },
    {
      request: { query: MaterialsDocument, variables: () => true },
      result: (vars) => ({ data: { materials: vars.taskId === TASK_ID ? [serverMaterial] : [] } }),
      maxUsageCount: 4,
    },
    { request: { query: AllEvidenceDocument, variables: {} }, result: { data: { evidence: [] } }, maxUsageCount: 4 },
    { request: { query: AbandonQuizSessionDocument, variables: () => true }, result: { data: { __typename: "Mutation", abandonQuizSession: { __typename: "AbandonSessionPayload", session: { __typename: "QuizSession", id: SESSION_ID, status: "abandoned" } } } }, maxUsageCount: 4 },
  ];
  if (options.session !== undefined) {
    mocks.push({
      request: { query: QuizSessionDocument, variables: { id: SESSION_ID } },
      result: { data: { quizSession: session } },
      maxUsageCount: 6, // remounts re-fire the session read
    });
  }
  // The launch-completion mocks (LAST — after the session-specific mock above,
  // so an existing test's SESSION_ID read still matches its own mock first):
  // the echo persists the driver's generated questions, and the page's
  // post-launch ?session=<echo id> read answers the same active task session.
  mocks.push({
    request: { query: CreateQuizSessionDocument, variables: () => true },
    result: (vars) => {
      const input = (vars as { input: { mode: string; questions: Array<Record<string, unknown>> } }).input;
      const sessionId = "s-echo-launch";
      return {
        data: {
          __typename: "Mutation",
          createQuizSession: {
            __typename: "CreateSessionPayload",
            session: {
              __typename: "QuizSession",
              id: sessionId,
              planId: null,
              taskId: TASK_ID,
              mode: input.mode,
              status: "active",
              createdAt: "2026-11-01T00:00:00Z",
              completedAt: null,
            },
            questions: input.questions.map((q, i) => echoQuestion(q, sessionId, i)),
          },
        },
      };
    },
  });
  mocks.push({
    request: { query: QuizSessionDocument, variables: () => true },
    result: (vars) => ({
      data: {
        quizSession: {
          __typename: "QuizSession",
          id: (vars as { id: string }).id,
          planId: null,
          taskId: TASK_ID,
          mode: "choice",
          status: "active",
          createdAt: "2026-11-01T00:00:00Z",
          completedAt: null,
          questions: [
            serverQuestion("q-echo-1", "Choice one", 0, "sec-1"),
            serverQuestion("q-echo-2", "Choice two", 1, "sec-2"),
          ],
        },
      },
    }),
    maxUsageCount: 4,
  });
  return mocks;
}

function TaskLanding() {
  return <p data-testid="task-landing" />;
}
function PlansLanding() {
  return <p data-testid="plans-landing" />;
}

function renderQuizPage(path: string, options: Parameters<typeof pageMocks>[0] = {}) {
  return render(
    <LanguageProvider>
      <MockedProvider mocks={pageMocks(options)}>
        <MemoryRouter initialEntries={[path]}>
          <Toaster />
          <Routes>
            <Route path="/task/:id/quiz" element={<TaskQuizPage />} />
            <Route path="/task/:id" element={<TaskLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  generatedQuizInputs.length = 0;
});

describe("TaskQuizPage — honest routes (T4; FR-37 parity; AD-6/8)", () => {
  it("unknown task id: the shared not-found with the way back to plans, never a blank screen", async () => {
    renderQuizPage("/task/no-such-task/quiz");
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("no ?session: the inline QuizLauncher is task-scoped — mode radios, NO scope picker; back goes to Task Home", async () => {
    renderQuizPage(`/task/${TASK_ID}/quiz`);

    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    // the mode select is here (all three radios)…
    expect(screen.getByTestId("quiz-mode-open")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-choice")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-mix")).toBeInTheDocument();
    // …but the scope select is not: the task's single material IS the scope
    expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quiz-launcher-start")).toBeInTheDocument();

    // the back link carries the task copy and lands on Task Home — asserted
    // last because it navigates away from the page under test
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToTask") }));
    expect(await screen.findByTestId("task-landing")).toBeInTheDocument();
  });

  it("a PLAN-owned session id reads as not-found on the task route (AD-6: sessions never cross)", async () => {
    renderQuizPage(`/task/${TASK_ID}/quiz?session=${SESSION_ID}`, {
      session: serverSession({ planId: "p-other", taskId: null }),
    });
    expect(await screen.findByText(zh("quiz.runner.notFound"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-runner")).not.toBeInTheDocument();
  });

  it("a task-owned active session resumes honestly — and exit-leave abandons back to Task Home", async () => {
    renderQuizPage(`/task/${TASK_ID}/quiz?session=${SESSION_ID}`, {
      session: serverSession({ planId: null, taskId: TASK_ID }),
    });

    // the shared shell's honest resume contract (T1: hydration lands on q1)
    expect(await screen.findByTestId("quiz-resumed-note")).toHaveTextContent(zh("quiz.runner.resumedNote"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zh("quiz.question").replace("{i}", "1").replace("{n}", "2"));

    // exit asks once; leaving marks abandoned and navigates to TASK HOME
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText(zh("quiz.exitTitle"))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("quiz-exit-leave"));
    expect(await screen.findByTestId("task-landing")).toBeInTheDocument();
  });

  // T5 fix: the node click-through is a PLAN-route scope (targeting needs a
  // PLAN node — the server refuses task nodes under targeting). A stray
  // ?nodeId on the task route is ignored entirely: no node context strip and
  // NO targeting on the launch (the task's single material IS its scope).
  it("a stray ?nodeId on the task route is ignored: no node strip, NO targeting sent (targeting needs a PLAN node)", async () => {
    renderQuizPage(`/task/${TASK_ID}/quiz?nodeId=${NODE_ID}`);

    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-node-context")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quiz-mode-choice"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await waitFor(() => expect(generatedQuizInputs).toHaveLength(1), { timeout: 3000 });
    expect(generatedQuizInputs[0].targeting).toBeNull();
    expect(generatedQuizInputs[0].taskId).toBe(TASK_ID);
    expect(generatedQuizInputs[0].planId).toBeNull();
  });

  it("a Task Home DIALOG launch is a fresh start, not a resume — no 「已恢复」 note, marker consumed; a genuine reload of the same session keeps the honest note (T6)", async () => {
    sessionStorage.setItem(QUIZ_FRESH_LAUNCH_KEY, SESSION_ID);
    const first = renderQuizPage(`/task/${TASK_ID}/quiz?session=${SESSION_ID}`, {
      session: serverSession({ planId: null, taskId: TASK_ID }),
    });

    // the runner is up WITHOUT the resume note — nothing was resumed
    expect(await screen.findByTestId("quiz-runner")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument();
    // the marker was consumed, not leaked: a later reload finds none
    expect(sessionStorage.getItem(QUIZ_FRESH_LAUNCH_KEY)).toBeNull();

    // the reload simulation: a fresh mount over the same mocked api + URL
    first.unmount();
    renderQuizPage(`/task/${TASK_ID}/quiz?session=${SESSION_ID}`, {
      session: serverSession({ planId: null, taskId: TASK_ID }),
    });
    expect(await screen.findByTestId("quiz-resumed-note")).toHaveTextContent(zh("quiz.runner.resumedNote"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zh("quiz.question").replace("{i}", "1").replace("{n}", "2"));
  });
});

/**
 * The /quiz re-point tests (FR-42, epic P2-09 T4): the retained page is the
 * QUIZ HISTORY HUB — every session from the quizHistoryHub read model (T1's
 * aggregation, newest first) renders with its origin chip (the plan title
 * rides the wire; the task title resolves off the tasks read — the
 * MistakesPage convention), the mode chip, the log date, the question count,
 * and the GRADED-answers score summary ({correct} / {total} 正确) when graded
 * answers exist. A zero-graded row is the honest 未完成 label (evidence lands
 * only at completion, so zero graded answers = active or abandoned — the hub
 * never claims which). The plan/task filter is client rendering.
 *
 * The retake (the ticket's one schema movement): per COMPLETED row only — a
 * row shows the action exactly when graded answers exist — fires
 * retakeQuizSession (the api mints the NEW session server-side; never a
 * replay of graded answers, NFR-8), then navigates to the new session's FLOW
 * route (/plan/:id/quiz?session= / /task/:id/quiz?session=) with the
 * fresh-launch marker set (the hub just started this round in this tab).
 *
 * The epic-6 T5 material picker + demo copy retired with this re-point —
 * asserted by residue absence (the picker copy never renders; the page source
 * carries no picker/picker-launch machinery).
 *
 * Apollo-level stub (the harness double): handlers answer the hub read, the
 * tasks list read, and the retake mutation with wire-shaped fixtures.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import QuizPage from "./QuizPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const NOW = "2026-11-01T00:00:00Z";
const PLAN_1 = "plan-1";
const TASK_1 = "task-1";
const TASK_NODE = "task-node-1";

const tasks: EchoFixture[] = [
  {
    __typename: "StudyTask",
    id: TASK_1,
    materialId: "m-task",
    nodeId: TASK_NODE,
    createdAt: NOW,
    node: { __typename: "KnowledgeNode", id: TASK_NODE, planId: null, taskId: TASK_1, description: null, optional: false, stage: null, title: "TCP 拥塞控制", order: 0, masteryScore: "0", state: "uncovered", createdAt: NOW },
  },
];

/** The factory hub graph (newest-first, server order): a graded plan quiz, a
 * graded task quiz, an in-progress row (zero graded answers), an abandoned
 * row (also zero graded — the honest label covers both, never a status claim). */
const hubEntries: EchoFixture[] = [
  {
    __typename: "QuizHistoryEntry",
    sessionId: "s-1",
    planId: PLAN_1,
    planTitle: "软工备考",
    taskId: null,
    mode: "mix",
    createdAt: "2026-11-01T00:00:00Z",
    questionCount: 4,
    scoreSummary: { __typename: "QuizScoreSummary", correct: 3, total: 4 },
  },
  {
    __typename: "QuizHistoryEntry",
    sessionId: "s-2",
    planId: null,
    planTitle: null,
    taskId: TASK_1,
    mode: "choice",
    createdAt: "2026-10-31T00:00:00Z",
    questionCount: 5,
    scoreSummary: { __typename: "QuizScoreSummary", correct: 5, total: 5 },
  },
  {
    __typename: "QuizHistoryEntry",
    sessionId: "s-3",
    planId: PLAN_1,
    planTitle: "软工备考",
    taskId: null,
    mode: "open",
    createdAt: "2026-10-30T00:00:00Z",
    questionCount: 3,
    scoreSummary: { __typename: "QuizScoreSummary", correct: 0, total: 0 },
  },
  {
    __typename: "QuizHistoryEntry",
    sessionId: "s-4",
    planId: null,
    planTitle: null,
    taskId: TASK_1,
    mode: "open",
    createdAt: "2026-10-29T00:00:00Z",
    questionCount: 2,
    scoreSummary: { __typename: "QuizScoreSummary", correct: 0, total: 0 },
  },
];

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function hubHandlers(entries: EchoFixture[], retakeSession?: { id: string; planId: string | null; taskId: string | null }) {
  const handlers: LooseHandlers = {
    QuizHistoryHub: () => entries,
    Tasks: () => tasks,
  };
  if (retakeSession) {
    handlers.RetakeQuizSession = (variables) => {
      expect((variables.input as Record<string, unknown>).sessionId).toBeTruthy();
      return {
        session: { __typename: "QuizSession", id: retakeSession.id, status: "active", mode: "open", planId: retakeSession.planId, taskId: retakeSession.taskId },
      };
    };
  }
  return handlers;
}

/** The flow-route probe: renders the owner id + the session param it landed with. */
function FlowLanding() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  return <p data-testid="flow-landing">{`${id}|${searchParams.get("session") ?? ""}`}</p>;
}

function renderQuizPage(handlers: LooseHandlers) {
  const client = createStubClient(handlers as Record<string, (variables: Record<string, unknown>) => unknown>, {
    sessions: [],
    evidence: [],
    mistakes: [],
    plans: [],
  });
  const Wrapper = makeStubWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={["/quiz"]}>
        <LanguageProvider>
          <Routes>
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/plan/:id/quiz" element={<FlowLanding />} />
            <Route path="/task/:id/quiz" element={<FlowLanding />} />
            <Route path="/plans" element={<p data-testid="plans-landing" />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("QuizPage — the history hub (FR-42, epic P2-09 T4)", () => {
  it("renders every session newest-first: origin chip, mode chip, date, question count, and the graded score summary", async () => {
    renderQuizPage(hubHandlers(hubEntries));

    // scores render ({correct} / {total} 正确 — the dictionary as the source)
    expect(await screen.findByText(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }))).toBeTruthy();
    expect(screen.getByText(zhVars("quizHub.scoreSummary", { correct: 5, total: 5 }))).toBeTruthy();

    // the zero-graded rows read the honest 未完成 label — never a score, never
    // a completed/abandoned claim (the wire carries no status)
    expect(screen.getAllByText(zh("quizHub.ungraded"))).toHaveLength(2);

    // origin chips: the plan title rides the wire (filter option + section-less
    // row chip + ...), the task title resolves off the tasks read
    expect(screen.getAllByText("TCP 拥塞控制").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("软工备考").length).toBeGreaterThanOrEqual(2);

    // mode chips use the hub's own vocabulary
    expect(screen.getByText(zh("quizHub.modeMix"))).toBeTruthy();
    expect(screen.getByText(zh("quizHub.modeChoice"))).toBeTruthy();
    expect(screen.getAllByText(zh("quizHub.modeOpen"))).toHaveLength(2);

    // question counts render
    expect(screen.getByText(zhVars("quizHub.questions", { n: 4 }))).toBeTruthy();
    expect(screen.getByText(zhVars("quizHub.questions", { n: 2 }))).toBeTruthy();

    // the header carries the real count
    expect(screen.getByText(zhVars("quizHub.subtitle", { n: 4 }))).toBeTruthy();

    // newest first (the server order — the first score text is s-1's 3/4)
    const scores = screen.getAllByText(/正确$/);
    expect(scores[0].textContent).toBe(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }));
  });

  it("filters by plan or task through the dropdown", async () => {
    renderQuizPage(hubHandlers(hubEntries));

    const picker = (await screen.findByRole("combobox", { name: zh("quizHub.filterLabel") })) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: `task:${TASK_1}` } });
    expect(screen.getByText(zhVars("quizHub.scoreSummary", { correct: 5, total: 5 }))).toBeTruthy();
    expect(screen.queryByText(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }))).toBeNull();
    expect(screen.getAllByText(zh("quizHub.ungraded"))).toHaveLength(1);

    fireEvent.change(picker, { target: { value: `plan:${PLAN_1}` } });
    expect(screen.getByText(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }))).toBeTruthy();
    expect(screen.queryByText(zhVars("quizHub.scoreSummary", { correct: 5, total: 5 }))).toBeNull();

    fireEvent.change(picker, { target: { value: "" } });
    expect(screen.getByText(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }))).toBeTruthy();
    expect(screen.getByText(zhVars("quizHub.scoreSummary", { correct: 5, total: 5 }))).toBeTruthy();
  });

  it("retake fires per graded row only, then navigates to the NEW session's flow route (plan scope)", async () => {
    renderQuizPage(hubHandlers(hubEntries, { id: "s-new", planId: PLAN_1, taskId: null }));

    expect(await screen.findByText(zhVars("quizHub.scoreSummary", { correct: 3, total: 4 }))).toBeTruthy();

    // exactly the graded rows carry the retake action — the zero-graded rows
    // (in-progress / abandoned) never do
    const retakeButtons = screen.getAllByRole("button", { name: zh("quizHub.retakeAria") });
    expect(retakeButtons).toHaveLength(2);

    // retake the 3/4 plan session (the first button, newest first)
    sessionStorage.removeItem("synapse-quiz-fresh-launch");
    fireEvent.click(retakeButtons[0]);

    // navigation lands on the plan flow route with the NEW session id, and the
    // fresh-launch marker is set (the hub started this round in this tab)
    await waitFor(() => expect(screen.getByTestId("flow-landing").textContent).toBe(`${PLAN_1}|s-new`));
    expect(sessionStorage.getItem("synapse-quiz-fresh-launch")).toBe("s-new");
  });

  it("retake of a task-scoped session navigates to the task flow route", async () => {
    renderQuizPage(hubHandlers(hubEntries, { id: "s-task-new", planId: null, taskId: TASK_1 }));

    expect(await screen.findByText(zhVars("quizHub.scoreSummary", { correct: 5, total: 5 }))).toBeTruthy();

    // the graded rows newest-first: [plan 3/4, task 5/5] — the second button is
    // the task session's
    const retakeButtons = screen.getAllByRole("button", { name: zh("quizHub.retakeAria") });
    fireEvent.click(retakeButtons[1]);

    await waitFor(() => expect(screen.getByTestId("flow-landing").textContent).toBe(`${TASK_1}|s-task-new`));
  });

  it("empty history → the honest empty state with the plans path (never a demo fallback)", async () => {
    renderQuizPage(hubHandlers([]));

    expect(await screen.findByText(zh("quizHub.emptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("quizHub.emptyBody"))).toBeTruthy();
    expect(screen.getByRole("link", { name: zh("quizHub.emptyCta") }).getAttribute("href")).toBe("/plans");

    // demo residue absent: the RETIRED picker copy never renders again (the
    // picker is gone — the independent source)
    expect(screen.queryByText("选择一份材料出题")).toBeNull();
    expect(screen.queryByText("还没有可以出题的材料")).toBeNull();
    expect(screen.queryByTestId("quiz-demo-picker")).toBeNull();
  });

  it("renders nothing while the hub read is loading (honest-empty, no flash of stale copy)", () => {
    const { container } = renderQuizPage(hubHandlers(hubEntries));
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(zh("quizHub.emptyTitle"))).toBeNull();
  });

  it("the no-residue audit: the page carries no picker / demo machinery", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/QuizPage.tsx"), "utf8");
    for (const banned of ["quiz.demo.", "MaterialPicker", "PickerRow", "quizableMaterials", "QuizSessionPage", "useMaterialQuery", "demo-data"]) {
      expect(page, `QuizPage.tsx must not contain ${banned}`).not.toContain(banned);
    }
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  abandonQuizSession,
  createPlan,
  createQuizSession,
  getQuizSession,
  listEvidence,
  listQuestionsBySession,
  loadDb,
  recordEvidence,
  registerMaterial,
  type AnswerResult,
} from "@/data";
import type { MaterialSection } from "@/domain/entities";
import PlanQuizPage from "./PlanQuizPage";

/**
 * PlanQuizPage observable states (T2; spec testing seam 3 — component render
 * seam over real hooks, the simulated AI service, and the seeded repository):
 * honest not-founds (unknown plan / unknown session / foreign-plan session),
 * the runner flows (choice select + confirm, open with the grading wait,
 * forfeit, hint, the keyboard map, exit-asks-once → abandoned), resumption
 * (active resumes honestly at question 1; terminal sessions refuse), and the
 * results screen with EXACT ADR-0001 numbers (cap-99 below the gate) plus the
 * mistakes the evidence mutation logged. Expected copy reads the copy deck
 * directly, never recomputed.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

function seedPlan() {
  const { plan, nodes } = createPlan({
    topic: "软工备考",
    goal: null,
    nodes: [
      { title: "软件测试", stage: "核心" },
      { title: "需求工程", stage: "核心" },
    ],
  });
  const { material } = registerMaterial({
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: plan.id,
    taskId: null,
    sections,
    parseState: "parsed",
  });
  return { plan, nodes, material };
}

function PlanLanding() {
  return <p data-testid="plan-landing" />;
}
function PlansLanding() {
  return <p data-testid="plans-landing" />;
}

function renderQuizPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Toaster />
          <Routes>
            <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
            <Route path="/plan/:id" element={<PlanLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

/** A choice-mode session for THIS plan via the page's inline launcher. */
async function launchChoiceFromPage(planId: string) {
  renderQuizPage(`/plan/${planId}/quiz`);
  fireEvent.click(await screen.findByTestId("quiz-mode-choice"));
  fireEvent.click(screen.getByTestId("quiz-launcher-start"));
  // start → generating (600ms beat) → session persisted → the page hydrates it → runner
  await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
  const session = loadDb().sessions[loadDb().sessions.length - 1];
  return session;
}

/** Answer a choice question by picking an option's text (the generator's correct option is its section title). */
function pickOption(text: string) {
  fireEvent.click(screen.getByRole("button", { name: text }));
  fireEvent.click(screen.getByTestId("quiz-confirm"));
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A hand-built active session (the reload path — never started on this mount). */
function seedSession(planId: string, nodeId: string, materialId: string) {
  return createQuizSession({
    planId,
    taskId: null,
    mode: "choice",
    questions: [
      {
        prompt: "Choice one",
        nodeId,
        kind: "choice",
        options: ["right", "wrong"],
        correctOptionIndex: 0,
        sourceMaterialId: materialId,
        sourceSectionId: "sec-1",
        explanation: "because",
      },
      {
        prompt: "Choice two",
        nodeId,
        kind: "choice",
        options: ["wrong", "right"],
        correctOptionIndex: 1,
        sourceMaterialId: materialId,
        sourceSectionId: "sec-2",
        explanation: "because too",
      },
    ],
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("PlanQuizPage — honest routes (FR-18; AD-8)", () => {
  it("unknown plan id: the shared not-found with the way back, never a blank screen", async () => {
    renderQuizPage("/plan/no-such-plan/quiz");
    expect(await screen.findByText(zh("plans.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("plans.backToPlans") })).toBeInTheDocument();
  });

  it("no ?session: the inline QuizLauncher renders", async () => {
    const { plan } = seedPlan();
    renderQuizPage(`/plan/${plan.id}/quiz`);
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-launcher-start")).toBeInTheDocument();
  });

  it("unknown session id: honest not-found with a new-quiz way out", async () => {
    const { plan } = seedPlan();
    renderQuizPage(`/plan/${plan.id}/quiz?session=no-such-session`);
    expect(await screen.findByText(zh("quiz.runner.notFound"))).toBeInTheDocument();
    expect(screen.getByTestId("quiz-session-unknown")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-terminal-new")).toBeInTheDocument();
  });

  it("a session from another plan reads as not-found on this plan's route", async () => {
    const { plan } = seedPlan();
    const other = createPlan({ topic: "别的计划", goal: null, nodes: [{ title: "n", stage: null }] });
    const { session } = seedSession(other.plan.id, other.nodes[0].id, "m-any");
    renderQuizPage(`/plan/${plan.id}/quiz?session=${session.id}`);
    expect(await screen.findByText(zh("quiz.runner.notFound"))).toBeInTheDocument();
  });
});

describe("PlanQuizPage — the runner (NFR-8 attempt gate; UX spine)", () => {
  it("choice flow: nothing reveals before submit; select + confirm reveals the verdict with the correct option marked; progress advances", async () => {
    const { plan } = seedPlan();
    await launchChoiceFromPage(plan.id);

    // attempt gate observable in render: no verdict, no rationale/reference labels,
    // no option pre-highlighted (aria-pressed all false)
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 2 }));
    expect(screen.queryByTestId("quiz-verdict-label")).not.toBeInTheDocument();
    expect(screen.queryByText(zh("quiz.reference"))).not.toBeInTheDocument();
    for (const i of [0, 1, 2]) {
      const option = screen.queryByTestId(`quiz-option-${i}`);
      if (option) expect(option).toHaveAttribute("aria-pressed", "false");
    }

    // q1's correct option is its own section title (generator contract)
    pickOption("集成测试");
    expect(await screen.findByTestId("quiz-verdict-label")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-verdict-label")).toHaveTextContent(zh("quiz.correct"));
    // the gate is open: the explanation (「参考答案」 strip) is now visible
    expect(screen.getByTestId("quiz-verdict").textContent).toContain(zh("quiz.reference"));

    fireEvent.click(screen.getByTestId("quiz-next"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 2, n: 2 }));
    expect(screen.getByRole("button", { name: "需求工程" })).toBeInTheDocument();
  });

  it("wrong pick: the verdict marks your wrong option and the correct one", async () => {
    const { plan } = seedPlan();
    await launchChoiceFromPage(plan.id);
    pickOption("需求工程"); // the other section's title — a real distractor
    const verdict = await screen.findByTestId("quiz-verdict");
    expect(verdict.textContent).toContain(zh("quiz.wrong"));
    expect(verdict.textContent).toContain("集成测试"); // the correct answer is revealed
  });

  it("open flow: textarea → 「对照材料评分中」 grading wait → verdict with rationale + citation quote", async () => {
    const { plan } = seedPlan();
    renderQuizPage(`/plan/${plan.id}/quiz`);
    fireEvent.click(await screen.findByTestId("quiz-mode-open"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await screen.findByTestId("quiz-runner");

    // one keyword hit → the partial verdict (the seam's ≥2/1/0 rule)
    fireEvent.change(screen.getByTestId("quiz-open-input"), { target: { value: "集成" } });
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    expect(screen.getByTestId("quiz-grading")).toHaveTextContent(zh("quiz.grading"));
    // gate holds through the wait: no verdict yet
    expect(screen.queryByTestId("quiz-verdict-label")).not.toBeInTheDocument();

    const verdict = await screen.findByTestId("quiz-verdict", {}, { timeout: 2500 });
    expect(verdict.textContent).toContain(zh("quiz.partial"));
    expect(verdict.textContent).toContain("对照材料评分"); // the AI seam's rationale
    expect(verdict.textContent).toContain("集成测试关注组件之间的交互。"); // the citation quote
    // mid-run honesty: evidence lands ONCE at completion — nothing yet
    expect(listEvidence()).toHaveLength(0);
  });

  it("forfeit 「直接看答案」: revealed as wrong with the forfeit label, logged as a mistake", async () => {
    const { plan } = seedPlan();
    const session = await launchChoiceFromPage(plan.id);
    fireEvent.click(screen.getByTestId("quiz-forfeit"));
    expect(await screen.findByTestId("quiz-verdict-label")).toHaveTextContent(zh("quiz.forfeited"));
    expect(screen.getByTestId("quiz-verdict").textContent).toContain(zh("quiz.verdictForfeit"));

    fireEvent.click(screen.getByTestId("quiz-next"));
    fireEvent.click(screen.getByRole("button", { name: "需求工程" }));
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next")); // last verdict → 查看结果 leads to results
    expect(await screen.findByTestId("quiz-results")).toBeInTheDocument();

    await waitFor(() => expect(listEvidence()).toHaveLength(2)); // forfeit(wrong) + correct
    const mistakes = loadDb().mistakes;
    expect(mistakes).toHaveLength(1); // only the forfeit was wrong
    expect(mistakes[0].forfeited).toBe(true);
    expect(mistakes[0].sessionId).toBe(session.id);
    expect(getQuizSession(session.id)?.status).toBe("completed");
  });

  it("hint: shows the source section TITLE, never the explanation — and is outcome-neutral", async () => {
    const { plan } = seedPlan();
    await launchChoiceFromPage(plan.id);
    fireEvent.click(screen.getByTestId("quiz-hint"));
    expect(await screen.findByTestId("quiz-hint-box")).toHaveTextContent(
      zhVars("quiz.hintSection", { section: "集成测试" }),
    );
    // the hint box carries the section name only — the explanation sentence stays hidden
    expect(screen.queryByTestId("quiz-hint-box").textContent).not.toContain("组件之间的交互");
    expect(screen.queryByTestId("quiz-verdict-label")).not.toBeInTheDocument();
    // the verdict after answering still grades normally (hint is free)
    pickOption("集成测试");
    expect(await screen.findByTestId("quiz-verdict-label")).toHaveTextContent(zh("quiz.correct"));
  });

  it("keyboard: 1–4 selects, Enter confirms, Enter advances the verdict", async () => {
    const { plan } = seedPlan();
    await launchChoiceFromPage(plan.id);

    fireEvent.keyDown(window, { key: "1" }); // select option 1
    expect(screen.getByTestId("quiz-option-0")).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "Enter" }); // confirm
    expect(await screen.findByTestId("quiz-verdict-label")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" }); // next
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 2, n: 2 }));
  });

  it("Esc asks once; leaving marks the session abandoned (not resumable) and navigates back", async () => {
    const { plan } = seedPlan();
    const session = await launchChoiceFromPage(plan.id);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText(zh("quiz.exitTitle"))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("quiz-exit-leave"));

    expect(await screen.findByTestId("plan-landing")).toBeInTheDocument(); // back to the plan
    expect(getQuizSession(session.id)?.status).toBe("abandoned");
    expect(listEvidence()).toHaveLength(0); // an abandoned session records nothing

    // ...and it is not resumable: the URL now shows the honest terminal card
    renderQuizPage(`/plan/${plan.id}/quiz?session=${session.id}`);
    expect(await screen.findByText(zh("quiz.runner.alreadyAbandoned"))).toBeInTheDocument();
  });
});

describe("PlanQuizPage — resumption (spec decision 7)", () => {
  it("an active session resumes honestly: 「从第 1 题继续」 note + question 1 — and completing it lands evidence for that session", async () => {
    const { plan, nodes, material } = seedPlan();
    const { session } = seedSession(plan.id, nodes[0].id, material.id);
    renderQuizPage(`/plan/${plan.id}/quiz?session=${session.id}`);

    expect(await screen.findByTestId("quiz-resumed-note")).toHaveTextContent(zh("quiz.runner.resumedNote"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 2 }));

    // play the resumed run through: both correct → the session completes
    pickOption("right");
    fireEvent.click(await screen.findByTestId("quiz-next"));
    pickOption("right"); // q2's correct option sits at index 1
    fireEvent.click(await screen.findByTestId("quiz-next"));
    expect(await screen.findByTestId("quiz-results")).toBeInTheDocument();

    await waitFor(() => {
      const evidence = listEvidence();
      expect(evidence).toHaveLength(2);
      expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
      expect(evidence.every((e) => e.outcome === "correct")).toBe(true);
    });
    expect(getQuizSession(session.id)?.status).toBe("completed");

    // both corrects on ONE node = 2 records, BELOW the 3-record gate → the
    // honest cap: 99, never 100 — and the cap note names the gate (ADR-0001)
    const results = screen.getByTestId("quiz-results");
    expect(results.textContent).toContain("0% → 99%");
    expect(results.textContent).toContain(zhVars("quiz.cap99Note", { n: 3 }));
    expect(results.textContent).toContain(zh("plans.statePartial"));
  });

  it("a completed session is not resumable — the honest already-done card", async () => {
    const { plan, nodes, material } = seedPlan();
    const { session, questions } = seedSession(plan.id, nodes[0].id, material.id);
    const results: AnswerResult[] = questions.map((q) => ({
      questionId: q.id,
      outcome: "correct",
      userAnswer: "right",
      forfeited: false,
    }));
    recordEvidence({ sessionId: session.id, results });
    renderQuizPage(`/plan/${plan.id}/quiz?session=${session.id}`);
    expect(await screen.findByText(zh("quiz.runner.alreadyDone"))).toBeInTheDocument();
    expect(screen.getByTestId("quiz-session-terminal")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-runner")).not.toBeInTheDocument();
  });
});

describe("PlanQuizPage — results: exact ADR-0001 numbers + mistakes (AD-6)", () => {
  it("node movement renders the domain seam's numbers — (1+0)/2 = 50 under the gate with the honest cap note — and no display arithmetic", async () => {
    const { plan } = seedPlan();
    const session = await launchChoiceFromPage(plan.id);
    // q1 correct, q2 forfeited — the generator round-robins over ALL candidates
    // BEFORE the mode filter, so a 2-section choice run lands BOTH questions on
    // the plan's first node: the one row honestly reads (1+0)/2 = 50, below gate.
    pickOption("集成测试");
    fireEvent.click(await screen.findByTestId("quiz-next"));
    fireEvent.click(screen.getByTestId("quiz-forfeit"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    const results = await screen.findByTestId("quiz-results");

    // score line: 1 correct, 0 partial, 2 total — from the dictionary, verbatim shape
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 1, p: 0, n: 2 }));
    // evidence-logged pill
    expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 2 }));
    expect(results.textContent).toContain("50%");

    // the one affected node: below the 3-record gate, the cap note names it
    expect(results.textContent).toContain("0% → 50%");
    expect(results.textContent).toContain(zhVars("quiz.cap99Note", { n: 3 }));
    // the state vocabulary: glyph + label, never color alone
    expect(screen.getAllByText(zh("plans.statePartial")).length).toBe(1);

    // mistakes section: the forfeit renders as the compare card (你的答案 vs 正确答案)
    expect(screen.getByText(zh("quiz.mistakesTitle"))).toBeInTheDocument();
    expect(screen.getAllByText(zh("quiz.yourGiven")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(zh("quiz.correctAnswer")).length).toBeGreaterThan(0);
    expect(results.textContent).toContain("需求工程"); // the forfeited question's correct option

    // the store's mistakes match what the screen claims (the mutation logged them)
    const mistakes = loadDb().mistakes;
    expect(mistakes).toHaveLength(1); // the forfeit — the correct pick logged no mistake
    expect(mistakes[0].forfeited).toBe(true);
    expect(mistakes[0].sourceLocation).toEqual({ kind: "markdown", sectionId: "sec-2" });
    expect(getQuizSession(session.id)?.status).toBe("completed");
  });

  it("再来一轮: a fresh generated session (new id), honestly labeled as near-identical", async () => {
    const { plan } = seedPlan();
    await launchChoiceFromPage(plan.id);
    pickOption("集成测试");
    fireEvent.click(await screen.findByTestId("quiz-next"));
    fireEvent.click(screen.getByRole("button", { name: "需求工程" }));
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    const results = await screen.findByTestId("quiz-results");

    // the honest retake label sits beside the action
    expect(screen.getByTestId("quiz-retake")).toBeInTheDocument();
    expect(results.textContent).toContain(zh("quiz.retakeNote"));

    const firstId = loadDb().sessions[loadDb().sessions.length - 1].id;
    fireEvent.click(screen.getByTestId("quiz-retake"));
    expect(await screen.findByTestId("quiz-retaking")).toBeInTheDocument(); // 「来自 N 份材料 · 正在出题」

    const runner = await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    expect(runner).toBeInTheDocument();
    const secondId = loadDb().sessions[loadDb().sessions.length - 1].id;
    expect(secondId).not.toBe(firstId); // a NEW generated session, never a replay
    expect(loadDb().sessions).toHaveLength(2);
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 2 }));
    expect(listQuestionsBySession(secondId)).toHaveLength(2);
  });
});

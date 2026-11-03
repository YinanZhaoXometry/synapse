/**
 * Epic-6 integration walk (T2): the PLAN QUIZ loop (FR-18) walked across the
 * same seams as the epic-5 task loop — from Plan Home's quick-actions (the UX
 * journey 「Mix quiz launched from Plan Home quick-actions」) through the real
 * launcher dialog → the AI seam's generation over the attached material's
 * parsed sections → the persisted session carried in the URL → answering
 * across BOTH modes in one interleaved mix run → the atomic evidence batch
 * (recordEvidence at completion, auto-mistakes) → the results screen's
 * mastery movement rendered through the display-shaping selectors with exact
 * ADR-0001 numbers → a reload simulation resuming the session honestly from
 * the same localStorage key.
 *
 * ADR-0001 numbers asserted (the worked sequence below — 2 plan nodes, the
 * generator round-robins node attribution: q1→n1, q2→n2, q3→n1, q4→n2):
 *   - mix interleaves choice and open, generator order (choice, open ×2);
 *   - n1 (two corrects): raw 100 but BELOW the 3-record gate → 99 with the
 *     honest cap note — the gate gates the score itself (ADR-0001 amendment);
 *   - n2 (two partials): round(100 × 0.5) = 50, also below the gate;
 *   - round score = round(100 × (1 + 0.5 + 1 + 0.5) / 4) = 75;
 *   - partial ≠ wrong → zero mistakes; evidence lands exactly once, at
 *     completion, with per-question node attribution (AD-6).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  STORAGE_KEY,
  createPlan,
  getQuizSession,
  listEvidence,
  listEvidenceByNode,
  loadDb,
  registerMaterial,
} from "@/data";
import { computeNodeScore, getNodeState } from "@/domain/mastery";
import type { MaterialSection } from "@/domain/entities";
import PlanHomePage from "@/features/plans/PlanHomePage";
import PlanQuizPage from "@/pages/PlanQuizPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

function pickOption(text: string) {
  fireEvent.click(screen.getByRole("button", { name: text }));
  fireEvent.click(screen.getByTestId("quiz-confirm"));
}

/** Type an open answer naming ONE keyword fragment → the partial verdict (the seam's 1-hit rule). */
async function answerPartial(fragment: string) {
  fireEvent.change(screen.getByTestId("quiz-open-input"), { target: { value: fragment } });
  fireEvent.click(screen.getByTestId("quiz-confirm"));
  expect(screen.getByTestId("quiz-grading")).toHaveTextContent(zh("quiz.grading"));
  await screen.findByTestId("quiz-verdict", {}, { timeout: 2500 });
}

function renderApp(planId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[`/plan/${planId}`]}>
            <Toaster />
            <Routes>
              <Route path="/plan/:id" element={<PlanHomePage />} />
              <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("plan quiz loop — Plan Home quick-action → mix quiz → evidence → movement (FR-18; ADR-0001; AD-6)", () => {
  it("walks the whole loop at component + repository level with exact numbers", async () => {
    // -- material attached (the parse is already in — T2's entry contract) --
    const { plan, nodes } = createPlan({
      topic: "软工备考",
      goal: null,
      nodes: [
        { title: "软件测试", stage: "核心" },
        { title: "需求分析", stage: "核心" },
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
    expect(material.sections).toHaveLength(2);

    renderApp(plan.id);

    // -- Plan Home's 出题 quick-action opens the QuizLauncher dialog --
    // (the tile's accessible name is label + desc — click through the label)
    const quizTileLabel = await screen.findByText(zh("plans.quickQuiz"));
    const quizTile = quizTileLabel.closest("button");
    expect(quizTile).not.toBeNull();
    expect(quizTile).not.toHaveAttribute("aria-disabled", "true"); // quizable materials exist
    fireEvent.click(quizTileLabel);
    // the dialog is up: its title heading + the launcher form inside the portal
    expect(await screen.findByRole("heading", { name: zh("quiz.launcher.title") })).toBeInTheDocument();
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();

    // -- Mix mode selected → generating is visible and cancellable → launch --
    fireEvent.click(await screen.findByTestId("quiz-mode-mix"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zhVars("quiz.launcher.generating", { n: 1 }))).toBeInTheDocument();

    // the session the launcher persisted carries this plan's id — and the URL
    // now names it, so a reload can resume (spec decision 7)
    const runner = await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    expect(runner).toBeInTheDocument();
    // a dialog launch is a FRESH start, not a resume — no 「已恢复」 note (T6:
    // the launcher marks the session fresh; the shell consumes the marker)
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument();
    const session = getQuizSession(loadDb().sessions[loadDb().sessions.length - 1].id);
    expect(session?.planId).toBe(plan.id);
    expect(session?.status).toBe("active");
    expect(loadDb().questions.filter((q) => q.sessionId === session?.id)).toHaveLength(4);

    // -- one interleaved mix run: choice, open, choice, open (generator order) --
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 4 }));

    pickOption("集成测试"); // q1 choice → correct, auto-graded
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerPartial("集成"); // q2 open → 1 keyword hit → partial
    fireEvent.click(screen.getByTestId("quiz-next"));

    pickOption("需求工程"); // q3 choice → correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerPartial("需求"); // q4 open → partial — the LAST answer completes the run
    fireEvent.click(await screen.findByTestId("quiz-next")); // 查看结果

    // -- the results screen: the moment evidence lands (FR-3) --
    const results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 2, p: 2, n: 4 }));
    expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 4 }));
    expect(results.textContent).toContain("75%");

    // mastery movement through the selectors — the ADR-0001 exact numbers
    expect(results.textContent).toContain("0% → 99%"); // n1: 2 corrects, capped below the gate
    expect(results.textContent).toContain("0% → 50%"); // n2: 2 partials
    expect(screen.getAllByText(zhVars("quiz.cap99Note", { n: 3 })).length).toBe(2); // both under the gate
    expect(screen.getByText(zh("quiz.noMistakes"))).toBeInTheDocument(); // partial ≠ wrong

    // -- the repository agrees with the screen --
    const evidence = listEvidence();
    expect(evidence).toHaveLength(4);
    expect(evidence.map((e) => e.outcome)).toEqual(["correct", "partial", "correct", "partial"]);
    expect(evidence.filter((e) => e.nodeId === nodes[0].id)).toHaveLength(2);
    expect(evidence.filter((e) => e.nodeId === nodes[1].id)).toHaveLength(2);
    expect(evidence.every((e) => e.sessionId === session?.id)).toBe(true);
    expect(loadDb().mistakes).toHaveLength(0);
    expect(getQuizSession(session?.id ?? "")?.status).toBe("completed");

    // -- reload simulation: a fresh page over the same localStorage key --
    const completedAt = getQuizSession(session?.id ?? "")?.completedAt;
    expect(completedAt).toBeTruthy();
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain(session?.id ?? "");

    // the completed session's URL is no longer resumable — the honest card
    render(
      <LanguageProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <MemoryRouter initialEntries={[`/plan/${plan.id}/quiz?session=${session?.id}`]}>
            <Routes>
              <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </LanguageProvider>,
    );
    expect(await screen.findByText(zh("quiz.runner.alreadyDone"))).toBeInTheDocument();
  });
});

/**
 * The walk's second leg (T6): the ADR-0001 numbers the first walk's 2-record
 * chain cannot reach — the anti-inflation gate OPENING (mastered = ≥ 80 AND
 * ≥ 3 records) and the last-5 WINDOW evicting aged-out evidence. Three
 * generated mix rounds over the same plan via 再来一轮 (the honest retake —
 * fresh session ids, near-identical questions), launched INLINE on the quiz
 * route so the mount keeps its retake params. The generator is deterministic:
 * every round is q1 choice→n1, q2 open→n2, q3 choice→n1, q4 open→n2, and an
 * open answer carrying the section TITLE hits ≥ 2 keywords → correct, a
 * one-bigram answer → partial, an unrelated one → wrong.
 */
describe("plan quiz loop — retake chain: the gate opens, then the window evicts (ADR-0001 exact numbers)", () => {
  function renderQuizRoute(planId: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <LanguageProvider>
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[`/plan/${planId}/quiz`]}>
              <Toaster />
              <Routes>
                <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>,
    );
  }

  /** Type an open answer and wait through the grading beat to the verdict. */
  async function answerOpen(text: string) {
    fireEvent.change(screen.getByTestId("quiz-open-input"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    expect(screen.getByTestId("quiz-grading")).toHaveTextContent(zh("quiz.grading"));
    await screen.findByTestId("quiz-verdict", {}, { timeout: 2500 });
  }

  it("walks three rounds: 99 capped → 100 mastered at the 3-record gate → the last-5 window drags both nodes back down", { timeout: 30000 }, async () => {
    // -- the same two-node plan + one parsed material as the walk above --
    const { plan, nodes } = createPlan({
      topic: "软工备考",
      goal: null,
      nodes: [
        { title: "软件测试", stage: "核心" },
        { title: "需求分析", stage: "核心" },
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
    expect(material.sections).toHaveLength(2);

    renderQuizRoute(plan.id);

    // -- ROUND 1 (mix): correct, partial, correct, partial — the gate closed --
    fireEvent.click(await screen.findByTestId("quiz-launcher-start"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    const firstId = getQuizSession(loadDb().sessions[loadDb().sessions.length - 1].id)?.id;
    expect(firstId).toBeTruthy();

    pickOption("集成测试"); // q1 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("集成"); // q2 → n2 partial (1 keyword hit)
    fireEvent.click(screen.getByTestId("quiz-next"));
    pickOption("需求工程"); // q3 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("需求"); // q4 → n2 partial — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next")); // 查看结果

    let results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    // the chain's starting point — both nodes sit under the 3-record gate, so
    // both rows carry the honest cap (the walk above's exact numbers)
    expect(results.textContent).toContain("0% → 99%"); // n1: c,c capped
    expect(results.textContent).toContain("0% → 50%"); // n2: p,p capped
    expect(screen.getAllByText(zhVars("quiz.cap99Note", { n: 3 })).length).toBe(2);
    expect(screen.getByTestId("quiz-retake")).toBeInTheDocument(); // the inline launch keeps its params

    // -- ROUND 2 (再来一轮, all correct): the gate OPENS at the 3rd record --
    fireEvent.click(screen.getByTestId("quiz-retake"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    const secondId = getQuizSession(loadDb().sessions[loadDb().sessions.length - 1].id)?.id;
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId); // a fresh generated session, never a replay
    expect(loadDb().sessions).toHaveLength(2);

    pickOption("集成测试"); // q1 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("集成测试"); // q2 → n2 CORRECT (the section title = 2 keyword hits)
    fireEvent.click(screen.getByTestId("quiz-next"));
    pickOption("需求工程"); // q3 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("需求工程"); // q4 → n2 correct — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next"));

    results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(screen.getByTestId("quiz-score").textContent).toBe("100%"); // the round's score
    // per-node movement through the selectors: n1's 「before」 is round-1's
    // honest cap (99), and the number reaches 100 only now that the gate is met
    expect(results.textContent).toContain("99% → 100%"); // n1: 4 records ≥ 3
    expect(results.textContent).toContain("50% → 75%"); // n2: round(100 × (0.5+0.5+1+1)/4)
    // the cap note is gone — neither node is below the gate anymore
    expect(screen.queryByText(zhVars("quiz.cap99Note", { n: 3 }))).not.toBeInTheDocument();
    // the domain seam agrees — mastered = ≥ 80 AND ≥ 3 records (both true only now)
    expect(computeNodeScore(listEvidenceByNode(nodes[0].id))).toBe(100);
    expect(getNodeState(listEvidenceByNode(nodes[0].id))).toBe("mastered");
    expect(computeNodeScore(listEvidenceByNode(nodes[1].id))).toBe(75);
    expect(getNodeState(listEvidenceByNode(nodes[1].id))).toBe("partial"); // 75 < 80

    // -- ROUND 3 (再来一轮, all wrong): the last-5 WINDOW evicts round-1's corrects --
    fireEvent.click(screen.getByTestId("quiz-retake"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    expect(loadDb().sessions).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "需求工程" })); // q1 → n1 WRONG
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("没读过材料"); // q2 → n2 wrong (0 keyword hits)
    fireEvent.click(screen.getByTestId("quiz-next"));
    fireEvent.click(screen.getByRole("button", { name: "集成测试" })); // q3 → n1 wrong
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("没读过材料"); // q4 → n2 wrong — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next"));

    results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(screen.getByTestId("quiz-score").textContent).toBe("0%");
    // window-5 eviction, exact: n1's chronology c,c,c,c,w,w scores the LAST
    // FIVE (c,c,c,w,w = 60) — the un-windowed mean (4/6 ≈ 67%) never renders
    expect(results.textContent).toContain("100% → 60%"); // n1
    expect(results.textContent).toContain("75% → 50%"); // n2: last five p,c,c,w,w
    expect(screen.queryByText(zhVars("quiz.cap99Note", { n: 3 }))).not.toBeInTheDocument();
    // recent wrongs drag the STATE back down too: 60 < 80 → partial again
    expect(computeNodeScore(listEvidenceByNode(nodes[0].id))).toBe(60);
    expect(getNodeState(listEvidenceByNode(nodes[0].id))).toBe("partial");
    expect(computeNodeScore(listEvidenceByNode(nodes[1].id))).toBe(50);
    // the repository agrees with the screen across the whole chain
    expect(listEvidence()).toHaveLength(12); // 3 rounds × 4 answers
    expect(listEvidenceByNode(nodes[0].id)).toHaveLength(6); // c,c,c,c,w,w
    expect(listEvidenceByNode(nodes[1].id)).toHaveLength(6); // p,p,c,c,w,w
    for (const s of loadDb().sessions) expect(getQuizSession(s.id)?.status).toBe("completed");
    // the wrong round auto-logged its mistakes — the mutation's atomic tail
    expect(loadDb().mistakes).toHaveLength(4);
  });
});

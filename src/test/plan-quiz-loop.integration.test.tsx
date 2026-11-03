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
  loadDb,
  registerMaterial,
} from "@/data";
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

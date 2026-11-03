/**
 * Epic-6 integration walk (T4): the TASK loop with the real launches (FR-37
 * parity; FR-18/19) walked across the same seams as the plan-loop walk — from
 * Task Home's quick-action tiles through the QuizLauncher dialog (task-scoped:
 * no scope picker) → the AI seam's generation over the task's single material
 * → the persisted session carried in the URL (planId null, taskId set — AD-6)
 * → a choice-mode run answered to completion → the atomic evidence batch on
 * the TASK's own node (auto-mistakes none, all correct) → the results screen's
 * mastery movement with exact ADR-0001 numbers → the tasks-key invalidation
 * firing (the deferred epic-5 obligation) → Task Home's ring AND Plans Home's
 * Study Tasks section reading the FRESH score → a sibling plan untouched
 * (mastery never bleeds) → the flashcards leg (launcher dialog → study →
 * ratings persist, zero evidence — ADR-0001 story 26).
 *
 * ADR-0001 numbers asserted: 2 sections × choice mode = 2 questions, both
 * attributed to the task's single node (AD-6); both correct → round 100%, but
 * the node sits BELOW the 3-record gate → the honest cap: 0% → 99%, and the
 * cap note names the gate. The sibling plan's rollup stays 0 (uncovered).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  createPlan,
  createStudyTask,
  getQuizSession,
  listEvidence,
  listEvidenceByNode,
  loadDb,
  registerMaterial,
} from "@/data";
import { queryKeys } from "@/data/query-keys";
import { computeNodeScore, computePlanRollup, computeTaskRollup, getNodeState } from "@/domain/mastery";
import type { MaterialSection } from "@/domain/entities";
import PlansHomePage from "@/features/plans/PlansHomePage";
import TaskHomePage from "@/features/tasks/TaskHomePage";
import TaskFlashcardsPage from "@/pages/TaskFlashcardsPage";
import TaskQuizPage from "@/pages/TaskQuizPage";

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

function renderApp(taskId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // Freshness is observable BEFORE any surface mounts: prime the tasks list
  // entry (Plans Home's Study Tasks section reads it), then watch the
  // mutation's invalidation flip it stale (TanStack's own freshness signal).
  void client.fetchQuery({ queryKey: queryKeys.tasks.all, queryFn: () => Promise.resolve([]) });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const ui = render(
    <LanguageProvider>
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/task/${taskId}`]}>
            <Toaster />
            <Routes>
              <Route path="/task/:id" element={<TaskHomePage />} />
              <Route path="/task/:id/quiz" element={<TaskQuizPage />} />
              <Route path="/task/:id/flashcards" element={<TaskFlashcardsPage />} />
              <Route path="/plans" element={<PlansHomePage />} />
              <Route path="/plan/:id" element={<p data-testid="plan-landing" />} />
              <Route path="/plan/new" element={<p data-testid="plan-create-landing" />} />
              <Route path="/task/new" element={<p data-testid="task-create-landing" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </LanguageProvider>,
  );
  return { client, invalidateSpy, unmount: ui.unmount };
}

beforeEach(() => {
  localStorage.clear();
});

describe("task quiz loop — Task Home tile → task quiz → evidence on the task's node → fresh everywhere (FR-37; AD-6; ADR-0001)", () => {
  it("walks the whole loop at component + repository level with exact numbers and no mastery bleed", async () => {
    // -- the task: one material (parsed), one auto-owned node (AD-6) --
    const { material } = registerMaterial({
      title: "复习讲义.md",
      kind: "markdown",
      sizeBytes: 64,
      planId: null,
      taskId: null,
      sections,
      parseState: "parsed",
    });
    const { task, node } = createStudyTask({ materialId: material.id });

    // -- the AD-6 isolation control: a sibling plan sharing NOTHING --
    const { nodes: planNodes } = createPlan({
      topic: "别的计划",
      goal: null,
      nodes: [{ title: "计划节点", stage: "核心" }],
    });

    const { client, invalidateSpy } = renderApp(task.id);

    // -- Task Home: ring uncovered, tiles real --
    expect(await screen.findByRole("heading", { name: "复习讲义.md" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 0 }) })).toBeInTheDocument();

    // -- the quiz tile opens the task-scoped QuizLauncher dialog (mode only) --
    fireEvent.click(screen.getByTestId("task-quiz-tile"));
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument(); // the material IS the scope

    // -- choice mode → generating → the runner (the session rides in the URL) --
    fireEvent.click(screen.getByTestId("quiz-mode-choice"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zhVars("quiz.launcher.generating", { n: 1 }))).toBeInTheDocument();
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });

    // the persisted session is TASK-owned (AD-6): planId null, taskId set
    const session = getQuizSession(loadDb().sessions[loadDb().sessions.length - 1].id);
    expect(session?.planId).toBeNull();
    expect(session?.taskId).toBe(task.id);
    expect(session?.status).toBe("active");
    const questions = loadDb().questions.filter((q) => q.sessionId === session?.id);
    expect(questions).toHaveLength(2); // 2 sections × choice mode
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([node.id])); // the TASK's node, every question

    // -- both correct (the generator's correct option is its section title) --
    pickOption("集成测试");
    fireEvent.click(await screen.findByTestId("quiz-next"));
    pickOption("需求工程");
    fireEvent.click(await screen.findByTestId("quiz-next")); // the last verdict → results

    // -- the results: exact ADR-0001 numbers through the display selectors --
    const results = await screen.findByTestId("quiz-results", {}, { timeout: 3000 });
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 2, p: 0, n: 2 }));
    expect(results.textContent).toContain("100%"); // the round's score
    expect(results.textContent).toContain("0% → 99%"); // below the gate: the honest cap
    expect(results.textContent).toContain(zhVars("quiz.cap99Note", { n: 3 }));
    expect(screen.getByText(zh("quiz.noMistakes"))).toBeInTheDocument();

    // -- the repository agrees: evidence lands on the TASK's node only --
    await waitFor(() => expect(listEvidence()).toHaveLength(2));
    const evidence = listEvidence();
    expect(evidence.every((e) => e.nodeId === node.id)).toBe(true);
    expect(evidence.every((e) => e.sessionId === session?.id)).toBe(true);
    expect(computeNodeScore(listEvidenceByNode(node.id))).toBe(99); // capped — raw would be 100
    expect(computeTaskRollup(listEvidenceByNode(node.id))).toBe(99); // the task rollup = its single node
    expect(getNodeState(listEvidenceByNode(node.id))).toBe("partial"); // ≥80 but the gate unmet
    expect(loadDb().mistakes).toHaveLength(0); // all correct → no mistakes
    expect(getQuizSession(session?.id ?? "")?.status).toBe("completed");

    // -- the sibling plan is untouched (mastery never bleeds, AD-6) --
    expect(listEvidenceByNode(planNodes[0].id)).toHaveLength(0);
    expect(computePlanRollup({ [planNodes[0].id]: listEvidenceByNode(planNodes[0].id) })).toBe(0);

    // -- the deferred epic-5 obligation fires: the tasks keys are invalidated --
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    expect(client.getQueryState(queryKeys.tasks.all)?.isInvalidated).toBe(true);

    // -- Task Home reads the FRESH score (evidence keys invalidated → refetch) --
    fireEvent.click(screen.getByTestId("quiz-back-to-plan")); // labelled 「返回任务」
    expect(await screen.findByRole("heading", { name: "复习讲义.md" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument();
    expect(screen.getAllByText("99%").length).toBeGreaterThan(0); // the node row's fresh number

    // -- Plans Home's Study Tasks section reads the FRESH score too --
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToPlans") }));
    expect(await screen.findByText(zh("tasks.eyebrow"))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument(); // the task row's ring
    // and the sibling plan's card still reads its untouched 0 rollup
    expect(screen.getAllByRole("img", { name: zhVars("plans.masteryAria", { n: 0 }) }).length).toBeGreaterThan(0);

    // -- the flashcards leg: launcher dialog → study → ratings never move evidence --
    fireEvent.click(screen.getByRole("link", { name: /复习讲义\.md/ })); // the task row → Task Home
    expect(await screen.findByTestId("task-flashcards-tile")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("task-flashcards-tile")); // no cards yet → the launcher dialog
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    const study = await screen.findByTestId("flashcards-study", {}, { timeout: 3000 });
    expect(study).toBeInTheDocument(); // onCreated navigated to the study route

    // the generated deck: one card per section (the seam's material-section order)
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 2 }));
    fireEvent.keyDown(window, { key: " " }); // flip card 1
    expect(screen.getByTestId("flashcards-back")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("flashcards-rate-hard")); // rating advances to card 2
    await screen.findAllByText(zhVars("flashcards.study.progress", { i: 2, n: 2 }));
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium")); // the last card rated → summary
    const summary = await screen.findByTestId("flashcards-summary");
    expect(summary.textContent).toContain(zhVars("flashcards.summary.breakdown", { n: 2, h: 1, m: 1, e: 0 }));

    // zero evidence from ratings (ADR-0001 story 26): the store is byte-identical
    expect(listEvidence()).toHaveLength(2);

    // -- back on Task Home: the deck exists (「继续学习」), the ring never moved --
    fireEvent.click(screen.getByTestId("flashcards-back-to-plan")); // labelled 「返回任务」
    const tile = await screen.findByTestId("task-flashcards-tile");
    expect(tile.textContent).toContain(zh("flashcards.tileContinue"));
    expect(tile.textContent).toContain(zhVars("flashcards.tileContinueDesc", { n: 2 }));
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument();
    expect(listEvidence()).toHaveLength(2); // still exactly the quiz's two records
  });
});

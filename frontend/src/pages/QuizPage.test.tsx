import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { UserProgressProvider, useUserProgress } from "@/contexts/UserProgressContext";
import {
  createPlan,
  createQuizSession,
  createStudyTask,
  getQuizSession,
  listEvidence,
  listQuestionsBySession,
  loadDb,
  registerMaterial,
} from "@/data";
import type { MaterialSection } from "@/domain/entities";
import { DEFAULT_MASTERY } from "@/lib/demo-data";
import QuizPage from "./QuizPage";

/**
 * QuizPage observable states (T5; spec decision 10, FR-36 carve-out): the
 * /quiz demo loop end-to-end over the REAL seam — picker (with owner labels,
 * AD-6) → generateQuiz → the shared runner (choice / open / forfeit across
 * modes) → evidence records attributed to the owning context's node → results
 * with the exact ADR-0001 numbers, where the "evidence logged" claim finally
 * matches store reality. Plus the honest edges (empty db, unknown ids), the
 * no-lies audit (no demo-data import, no scaffold progress write, no fake
 * timer — asserted on the page source AND functionally via a mastery probe),
 * retake (new session id, honest near-identical label), and resumption.
 * Expected copy reads the copy deck directly, never recomputed.
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

function seedTask() {
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
  return { task, node, material };
}

/** A mastery probe INSIDE the frozen scaffold context: its numbers must never move (T5 no-lies). */
function MasteryProbe() {
  const { mastery } = useUserProgress();
  return <p data-testid="mastery-probe">{JSON.stringify(mastery)}</p>;
}

function renderQuizPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <UserProgressProvider>
        {/* the probe rides along on EVERY render — the scaffold context is
            observable in every demo-flow test without extra wiring */}
        <MasteryProbe />
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Toaster />
            <Routes>
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/plans" element={<p data-testid="plans-landing" />} />
              <Route path="/task/new" element={<p data-testid="task-new-landing" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </UserProgressProvider>
    </LanguageProvider>,
  );
}

/** A mix-mode demo run over the seeded plan material, driven to completion through the page. */
async function runMixToResults(planMaterialId: string) {
  renderQuizPage("/quiz");
  fireEvent.click(await screen.findByTestId(`quiz-demo-material-${planMaterialId}`));
  // the picked material IS the scope — no scope radio exists to widen it behind the user's back
  expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
  expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("quiz-launcher-start")); // mix (default) — 4 questions
  await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
  const session = loadDb().sessions[loadDb().sessions.length - 1];

  // q1 choice — correct
  fireEvent.click(screen.getByRole("button", { name: "集成测试" }));
  fireEvent.click(screen.getByTestId("quiz-confirm"));
  fireEvent.click(await screen.findByTestId("quiz-next"));
  // q2 open — correct (hits both keywords: the section title + its first bigram)
  fireEvent.change(screen.getByTestId("quiz-open-input"), { target: { value: "集成测试" } });
  fireEvent.click(screen.getByTestId("quiz-confirm"));
  fireEvent.click(await screen.findByTestId("quiz-next", {}, { timeout: 3000 }));
  // q3 choice — forfeit (= wrong, ADR-0001)
  fireEvent.click(screen.getByTestId("quiz-forfeit"));
  fireEvent.click(await screen.findByTestId("quiz-next"));
  // q4 open — forfeit
  fireEvent.click(screen.getByTestId("quiz-forfeit"));
  fireEvent.click(await screen.findByTestId("quiz-next"));

  const results = await screen.findByTestId("quiz-results");
  return { session, results };
}

beforeEach(() => {
  localStorage.clear();
});

describe("QuizPage — the material picker (AD-6 owner labels, honest exclusions)", () => {
  it("lists every owned material with its owning-context label; an ownerless material is excluded, never invented an owner", async () => {
    const { plan, material: planMaterial } = seedPlan();
    const { material: taskMaterial } = seedTask();
    registerMaterial({
      title: "无主材料.md",
      kind: "markdown",
      sizeBytes: 8,
      planId: null,
      taskId: null,
      sections,
      parseState: "parsed",
    });
    renderQuizPage("/quiz");

    expect(await screen.findByTestId("quiz-demo-picker")).toBeInTheDocument();
    // plan-owned: labeled with the plan's topic…
    expect(screen.getByText(zhVars("quiz.demo.fromPlan", { plan: plan.topic }))).toBeInTheDocument();
    // …task-owned: labeled with the task's title (= its material's title, the TaskRow convention)
    expect(screen.getByText(zhVars("quiz.demo.fromTask", { task: taskMaterial.title }))).toBeInTheDocument();
    // both rows present; the ownerless one is excluded honestly
    expect(screen.getByTestId(`quiz-demo-material-${planMaterial.id}`)).toBeInTheDocument();
    expect(screen.queryByText("无主材料.md")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("fresh user (no materials): the honest empty state with plan/task creation paths — never a dead end", async () => {
    renderQuizPage("/quiz");
    expect(await screen.findByTestId("quiz-demo-empty")).toBeInTheDocument();
    expect(screen.getByText(zh("quiz.demo.emptyTitle"))).toBeInTheDocument();
    expect(screen.getByText(zh("quiz.demo.emptyBody"))).toBeInTheDocument();
    expect(screen.getByTestId("quiz-demo-goto-plans")).toHaveAttribute("href", "/plans");
    expect(screen.getByTestId("quiz-demo-goto-tasks")).toHaveAttribute("href", "/task/new");
  });
});

describe("QuizPage — the demo loop end-to-end (FR-36 carve-out; the claim becomes true)", () => {
  it("pick → generate → play (choice + open + forfeit in mix) → evidence attributed to the plan's nodes → results with exact ADR-0001 numbers — and the scaffold context never moves", async () => {
    const { plan, nodes, material } = seedPlan();
    const { session, results } = await runMixToResults(material.id);

    // the session is real and OWNED by the picked material's plan (AD-6)
    expect(session.planId).toBe(plan.id);
    expect(session.taskId).toBeNull();
    expect(getQuizSession(session.id)?.status).toBe("completed");
    expect(listQuestionsBySession(session.id)).toHaveLength(4);

    // evidence exists in the STORE, attributed to the owning plan's nodes
    await waitFor(() => expect(listEvidence()).toHaveLength(4));
    const evidence = listEvidence();
    const nodeIds = nodes.map((n) => n.id);
    expect(evidence.every((e) => nodeIds.includes(e.nodeId))).toBe(true);
    expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
    const nodeById = new Map(loadDb().nodes.map((n) => [n.id, n]));
    expect(evidence.every((e) => nodeById.get(e.nodeId)?.planId === plan.id)).toBe(true);

    // the mistakes the mutation auto-logged: exactly the two forfeits
    const mistakes = loadDb().mistakes;
    expect(mistakes).toHaveLength(2);
    expect(mistakes.every((m) => m.sessionId === session.id)).toBe(true);
    expect(mistakes.every((m) => m.forfeited)).toBe(true);
    expect(mistakes.every((m) => nodeIds.includes(m.nodeId))).toBe(true);

    // results: 2 correct + 2 forfeited wrongs over 4 → round(100 × 2 / 4) = 50
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 2, p: 0, n: 4 }));
    // the claim now MATCHES store reality: the pill says 4, the store holds 4
    expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 4 }));
    // node movement through the domain seam: each node (correct+wrong) = (1+0)/2 = 50, 0 before
    expect(results.textContent).toContain("0% → 50%");
    expect(results.textContent).toContain(zhVars("quiz.cap99Note", { n: 3 })); // 2 records < gate 3

    // NO-LIES, functional: the frozen scaffold mastery is untouched by the full run
    expect(screen.getByTestId("mastery-probe")).toHaveTextContent(JSON.stringify(DEFAULT_MASTERY));
  });

  it("task-owned material: the session owns the TASK, evidence lands on its single auto-owned node", async () => {
    const { task, node, material } = seedTask();
    renderQuizPage("/quiz");
    fireEvent.click(await screen.findByTestId(`quiz-demo-material-${material.id}`));
    fireEvent.click(await screen.findByTestId("quiz-launcher-start")); // mix default
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    const session = loadDb().sessions[loadDb().sessions.length - 1];
    expect(session.taskId).toBe(task.id);
    expect(session.planId).toBeNull();

    // play through: q1 choice correct, remaining three forfeited
    fireEvent.click(screen.getByRole("button", { name: "集成测试" }));
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByTestId("quiz-forfeit"));
      fireEvent.click(await screen.findByTestId("quiz-next"));
    }
    expect(await screen.findByTestId("quiz-results")).toBeInTheDocument();

    await waitFor(() => expect(listEvidence()).toHaveLength(4));
    // every record attributes to the task's ONE node (planId null, taskId set — AD-6)
    expect(listEvidence().every((e) => e.nodeId === node.id)).toBe(true);
    expect(node.planId).toBeNull();
    expect(node.taskId).toBe(task.id);
  });
});

describe("QuizPage — honest edges", () => {
  it("unknown session id: the honest not-found card with the way back to the picker", async () => {
    renderQuizPage("/quiz?session=no-such-session");
    expect(await screen.findByText(zh("quiz.runner.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("quiz.demo.backToPicker") })).toBeInTheDocument();
  });

  it("unknown material id: the honest material card", async () => {
    renderQuizPage("/quiz?material=no-such-material");
    expect(await screen.findByText(zh("quiz.demo.materialNotFound"))).toBeInTheDocument();
  });

  it("a parsed-but-empty material (nothing to quiz from): the honest not-quizable card", async () => {
    const { plan } = createPlan({ topic: "占位计划", goal: null, nodes: [{ title: "n", stage: null }] });
    const { material } = registerMaterial({
      title: "空材料.md",
      kind: "markdown",
      sizeBytes: 8,
      planId: plan.id, // owned — so the card names the RIGHT reason (not-quizable, not no-owner)
      taskId: null,
      sections: [], // parsed, but nothing to quiz from (the picker's quizable rule)
      parseState: "parsed",
    });
    renderQuizPage(`/quiz?material=${material.id}`);
    expect(await screen.findByText(zh("quiz.demo.notQuizable"))).toBeInTheDocument();
  });
});

describe("QuizPage — retake + resumption (twins' contract, demo surface)", () => {
  it("再来一轮: a fresh generated session (new id) with the honest near-identical label", async () => {
    const { material } = seedPlan();
    const { session } = await runMixToResults(material.id);
    const results = screen.getByTestId("quiz-results");

    expect(results.textContent).toContain(zh("quiz.retakeNote")); // 模拟出题 · 每轮题目相近
    fireEvent.click(screen.getByTestId("quiz-retake"));
    expect(await screen.findByTestId("quiz-retaking")).toBeInTheDocument(); // 「来自 1 份材料 · 正在出题」
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });

    const secondId = loadDb().sessions[loadDb().sessions.length - 1].id;
    expect(secondId).not.toBe(session.id);
    expect(loadDb().sessions).toHaveLength(2);
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument(); // a fresh round, not a resume
    expect(listQuestionsBySession(secondId)).toHaveLength(4);
  });

  it("an active session resumes honestly: 「从第 1 题继续」 — and completing it lands evidence for that session", async () => {
    const { plan, nodes, material } = seedPlan();
    const { session } = createQuizSession({
      planId: plan.id,
      taskId: null,
      mode: "choice",
      questions: [
        {
          prompt: "Choice one",
          nodeId: nodes[0].id,
          kind: "choice",
          options: ["right", "wrong"],
          correctOptionIndex: 0,
          sourceMaterialId: material.id,
          sourceSectionId: "sec-1",
          explanation: "because",
        },
        {
          prompt: "Choice two",
          nodeId: nodes[0].id,
          kind: "choice",
          options: ["wrong", "right"],
          correctOptionIndex: 1,
          sourceMaterialId: material.id,
          sourceSectionId: "sec-2",
          explanation: "because too",
        },
      ],
    });
    renderQuizPage(`/quiz?session=${session.id}`);

    expect(await screen.findByTestId("quiz-resumed-note")).toHaveTextContent(zh("quiz.runner.resumedNote"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 2 }));

    // play the resumed run through — the owner context came FROM the session
    fireEvent.click(screen.getByRole("button", { name: "right" }));
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    fireEvent.click(screen.getByRole("button", { name: "right" })); // q2's correct option sits at index 1
    fireEvent.click(screen.getByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));
    expect(await screen.findByTestId("quiz-results")).toBeInTheDocument();

    await waitFor(() => {
      const evidence = listEvidence();
      expect(evidence).toHaveLength(2);
      expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
      expect(evidence.every((e) => e.nodeId === nodes[0].id)).toBe(true);
    });
    // both corrects on ONE node = below the 3-record gate → the honest cap: 99, never 100
    expect(screen.getByTestId("quiz-results").textContent).toContain("0% → 99%");
    expect(screen.getByTestId("quiz-results").textContent).toContain(zhVars("quiz.cap99Note", { n: 3 }));
  });
});

describe("QuizPage — the no-lies audit (grep-level; T5's whole point)", () => {
  it("the page carries no demo-data / scaffold-progress / fake-timer residue, and demo-data carries no QUIZ_BANK", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/QuizPage.tsx"), "utf8");
    for (const banned of [
      "demo-data", // the hardcoded demo bank module — never imported here
      "QUIZ_BANK",
      "useUserProgress", // the frozen scaffold context receives no reads OR writes
      "applyQuizOutcome",
      "MasteryDelta",
      "setTimeout", // the fake generation/grading timers — the seam is real
    ]) {
      expect(page, `QuizPage.tsx must not contain ${banned}`).not.toContain(banned);
    }
    const demoData = readFileSync(resolve(process.cwd(), "src/lib/demo-data.ts"), "utf8");
    expect(demoData).not.toContain("QUIZ_BANK");
  });
});

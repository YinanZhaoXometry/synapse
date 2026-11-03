import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createPlan, createQuizSession, createStudyTask, registerMaterial } from "@/data";
import type { MaterialSection } from "@/domain/entities";
import TaskQuizPage from "./TaskQuizPage";

/**
 * TaskQuizPage observable states (T4; spec testing seam 3 — the LEAN
 * context-routing suite): the task page wires the shared QuizSessionPage shell
 * to the task's context. Full runner/launcher/results behavior is already
 * covered by the plan twin's suite (T2 — same components, same shell) and by
 * the task-loop integration walk; these tests assert only what is
 * task-scoped: the honest not-found, the inline launcher's task shape (mode
 * select, NO scope picker — the single material IS the scope), back targets
 * (Task Home / Plans Home), and AD-6 session ownership (a plan-owned session
 * id never runs on the task route; a task-owned one resumes). Expected copy
 * reads the copy deck directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

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

function TaskLanding() {
  return <p data-testid="task-landing" />;
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
            <Route path="/task/:id/quiz" element={<TaskQuizPage />} />
            <Route path="/task/:id" element={<TaskLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("TaskQuizPage — honest routes (T4; FR-37 parity; AD-6/8)", () => {
  it("unknown task id: the shared not-found with the way back to plans, never a blank screen", async () => {
    renderQuizPage("/task/no-such-task/quiz");
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("no ?session: the inline QuizLauncher is task-scoped — mode radios, NO scope picker; back goes to Task Home", async () => {
    const { task } = seedTask();
    renderQuizPage(`/task/${task.id}/quiz`);

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
    const { task } = seedTask();
    const { plan, nodes } = createPlan({ topic: "别的计划", goal: null, nodes: [{ title: "n", stage: null }] });
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
          sourceMaterialId: "m-any",
          sourceSectionId: "sec-1",
          explanation: "because",
        },
      ],
    });
    renderQuizPage(`/task/${task.id}/quiz?session=${session.id}`);
    expect(await screen.findByText(zh("quiz.runner.notFound"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-runner")).not.toBeInTheDocument();
  });

  it("a task-owned active session resumes honestly — and exit-leave abandons back to Task Home", async () => {
    const { task, node, material } = seedTask();
    const { session } = createQuizSession({
      planId: null,
      taskId: task.id,
      mode: "choice",
      questions: [
        {
          prompt: "Choice one",
          nodeId: node.id,
          kind: "choice",
          options: ["right", "wrong"],
          correctOptionIndex: 0,
          sourceMaterialId: material.id,
          sourceSectionId: "sec-1",
          explanation: "because",
        },
        {
          prompt: "Choice two",
          nodeId: node.id,
          kind: "choice",
          options: ["wrong", "right"],
          correctOptionIndex: 1,
          sourceMaterialId: material.id,
          sourceSectionId: "sec-2",
          explanation: "because too",
        },
      ],
    });
    renderQuizPage(`/task/${task.id}/quiz?session=${session.id}`);

    // the shared shell's honest resume contract (T1: hydration lands on q1)
    expect(await screen.findByTestId("quiz-resumed-note")).toHaveTextContent(zh("quiz.runner.resumedNote"));
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zh("quiz.question").replace("{i}", "1").replace("{n}", "2"));

    // exit asks once; leaving marks abandoned and navigates to TASK HOME
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText(zh("quiz.exitTitle"))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("quiz-exit-leave"));
    expect(await screen.findByTestId("task-landing")).toBeInTheDocument();
  });
});

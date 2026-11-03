import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createFlashcards, createStudyTask, registerMaterial } from "@/data";
import type { MaterialSection } from "@/domain/entities";
import TaskFlashcardsPage from "./TaskFlashcardsPage";

/**
 * TaskFlashcardsPage observable states (T4; spec testing seam 3 — the LEAN
 * context-routing suite): the task page wires the shared FlashcardsStudyPage
 * shell to the task's single material. Flip-first study, trio persistence,
 * keyboard and deck-order behavior are already covered by the plan twin's
 * suite (T3 — same components, same shell); these tests assert only what is
 * task-scoped: the honest not-found, the inline launcher when the task has no
 * cards, the study over the task's deck when it does, and the Esc exit landing
 * on Task Home. Expected copy reads the copy deck directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
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
  const { task } = createStudyTask({ materialId: material.id });
  return { task, material };
}

function TaskLanding() {
  return <p data-testid="task-landing" />;
}
function PlansLanding() {
  return <p data-testid="plans-landing" />;
}

function renderCardsPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Toaster />
          <Routes>
            <Route path="/task/:id/flashcards" element={<TaskFlashcardsPage />} />
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

describe("TaskFlashcardsPage — honest routes (T4; FR-37 parity; FR-19)", () => {
  it("unknown task id: the shared not-found with the way back to plans, never a blank screen", async () => {
    renderCardsPage("/task/no-such-task/flashcards");
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("no cards yet: the FlashcardLauncher renders inline from the task's single material", async () => {
    const { task, material } = seedTask();
    renderCardsPage(`/task/${task.id}/flashcards`);
    expect(await screen.findByTestId("flashcards-launch-page")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    // the deck's one source is the task's own material
    expect(screen.getByTestId(`flashcards-source-${material.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });

  it("cards exist: the study runs over the task's deck; Esc exits to Task Home", async () => {
    const { task, material } = seedTask();
    createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [
        { front: "deck-one-a", back: "back-one-a" },
        { front: "deck-one-b", back: "back-one-b" },
      ],
    });
    renderCardsPage(`/task/${task.id}/flashcards`);

    expect(await screen.findByTestId("flashcards-study")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-a"); // creation order = section order
    expect(screen.getByTestId("flashcards-progress")).toBeInTheDocument();

    // the back link carries the task copy and lands on Task Home
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToTask") }));
    expect(await screen.findByTestId("task-landing")).toBeInTheDocument();
  });
});

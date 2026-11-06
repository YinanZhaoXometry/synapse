import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { FlashcardsByMaterialDocument, MaterialsDocument, TaskDocument } from "@/types/graphql";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import TaskFlashcardsPage from "./TaskFlashcardsPage";

/**
 * TaskFlashcardsPage observable states (T4; spec testing seam 3 — the LEAN
 * context-routing suite over MockedProvider, the cutover's Apollo test seam):
 * the task page wires the shared FlashcardsStudyPage shell to the task's
 * single material. Flip-first study, trio persistence, keyboard and deck-order
 * behavior are already covered by the plan twin's suite (T3 — same components,
 * same shell); these tests assert only what is task-scoped: the honest
 * not-found, the inline launcher when the task has no cards, the study over
 * the task's deck when it does, and the back link landing on Task Home. Mock
 * data is server-shaped (fixtures off the generated fragment types,
 * `__typename` everywhere an id lives). Expected copy reads the copy deck
 * directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const TASK_ID = "t-1";
const MATERIAL_ID = "m-1";
const NODE_ID = "n-1";

const serverTask = {
  __typename: "StudyTask",
  id: TASK_ID,
  materialId: MATERIAL_ID,
  nodeId: NODE_ID,
  createdAt: "2026-11-01T00:00:00Z",
  node: {
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
  },
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

const serverCard = (id: string, front: string) => ({
  __typename: "Flashcard",
  id,
  materialId: MATERIAL_ID,
  nodeId: null,
  front,
  back: `back-${id}`,
  difficulty: null,
  createdAt: "2026-11-01T00:00:00Z",
});

function pageMocks(options: { cards?: Record<string, unknown>[] } = {}) {
  return [
    {
      // an unknown route id reads as server null (the honest not-found path)
      request: { query: TaskDocument, variables: () => true },
      result: (vars) => ({ data: { task: vars.id === TASK_ID ? serverTask : null } }),
      maxUsageCount: 3,
    },
    {
      request: { query: MaterialsDocument, variables: () => true },
      result: (vars) => ({ data: { materials: vars.taskId === TASK_ID ? [serverMaterial] : [] } }),
      maxUsageCount: 3,
    },
    {
      request: { query: FlashcardsByMaterialDocument, variables: () => true },
      result: { data: { flashcards: options.cards ?? [] } },
      maxUsageCount: 3,
    },
  ];
}

function TaskLanding() {
  return <p data-testid="task-landing" />;
}
function PlansLanding() {
  return <p data-testid="plans-landing" />;
}

function renderCardsPage(path: string, options: { cards?: Record<string, unknown>[] } = {}) {
  return render(
    <LanguageProvider>
      <MockedProvider mocks={pageMocks(options)}>
        <MemoryRouter initialEntries={[path]}>
          <Toaster />
          <Routes>
            <Route path="/task/:id/flashcards" element={<TaskFlashcardsPage />} />
            <Route path="/task/:id" element={<TaskLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

describe("TaskFlashcardsPage — honest routes (T4; FR-37 parity; FR-19)", () => {
  it("unknown task id: the shared not-found with the way back to plans, never a blank screen", async () => {
    renderCardsPage("/task/no-such-task/flashcards");
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("no cards yet: the FlashcardLauncher renders inline from the task's single material", async () => {
    renderCardsPage(`/task/${TASK_ID}/flashcards`);
    expect(await screen.findByTestId("flashcards-launch-page")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    // the deck's one source is the task's own material
    expect(screen.getByTestId(`flashcards-source-${MATERIAL_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });

  it("cards exist: the study runs over the task's deck; the back link lands on Task Home", async () => {
    renderCardsPage(`/task/${TASK_ID}/flashcards`, {
      cards: [
        serverCard("c-1", "deck-one-a"),
        serverCard("c-2", "deck-one-b"),
      ],
    });

    expect(await screen.findByTestId("flashcards-study")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-a"); // creation order = section order
    expect(screen.getByTestId("flashcards-progress")).toBeInTheDocument();

    // the back link carries the task copy and lands on Task Home
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToTask") }));
    expect(await screen.findByTestId("task-landing")).toBeInTheDocument();
  });
});

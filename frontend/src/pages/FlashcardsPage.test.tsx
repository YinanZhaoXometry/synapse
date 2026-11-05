/**
 * The /flashcards re-point tests (FR-41, epic P2-09 T4): the retained page
 * consumes ONLY the flashcardDecksHub read model (T1's aggregation) — every
 * generated deck across plans and tasks renders with its material title, its
 * origin chips (plan topic / task), the card count, and the deck's creation
 * date; grouping (plan sections + task sections) and the plan/task filter are
 * client rendering over the server-ordered rows. The study action deep-links
 * into the EXISTING flow routes (/plan/:id/flashcards, /task/:id/flashcards)
 * honestly per origin kind — the hub never generates (FR-19/FR-36). A deck
 * with NO origin renders without a study action (the attach contract says a
 * material always has plan or task; if the data ever violates it, the page
 * degrades honestly instead of inventing a route).
 *
 * The Phase-1 demo deck (FLASHCARDS fixture + the flash.* copy) retires with
 * this re-point — asserted by residue absence (the fixture copy never renders;
 * demo-data no longer carries the export).
 *
 * Apollo-level stub (the harness double): handlers answer the hub read plus
 * the tasks list read with wire-shaped fixtures.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import FlashcardsPage from "./FlashcardsPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const NOW = "2026-11-01T00:00:00Z";
const PLAN_1 = "plan-1";
const PLAN_2 = "plan-2";
const TASK_1 = "task-1";
const TASK_NODE = "task-node-1";

const deck = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "FlashcardDeckSummary",
  materialId: "m-x",
  materialTitle: "材料",
  planId: null,
  planTitle: null,
  taskId: null,
  cardCount: 0,
  createdAt: NOW,
  ...over,
});

const tasks: EchoFixture[] = [
  {
    __typename: "StudyTask",
    id: TASK_1,
    materialId: "m-task",
    nodeId: TASK_NODE,
    createdAt: NOW,
    node: { __typename: "KnowledgeNode", id: TASK_NODE, planId: null, taskId: TASK_1, stage: null, title: "TCP 拥塞控制", order: 0, masteryScore: "0", state: "uncovered", createdAt: NOW },
  },
];

/** The factory hub graph (the server's own order — the deck material's
 * createdAt): two plan decks, one task deck, one origin-less row. */
const hubDecks: EchoFixture[] = [
  deck({ materialId: "m-plan-1", materialTitle: "复习讲义.md", planId: PLAN_1, planTitle: "软工备考", cardCount: 12, createdAt: "2026-11-01T00:00:00Z" }),
  deck({ materialId: "m-task", materialTitle: "网络笔记.md", taskId: TASK_1, cardCount: 8, createdAt: "2026-10-31T00:00:00Z" }),
  deck({ materialId: "m-plan-2", materialTitle: "Lecture05.pdf", planId: PLAN_2, planTitle: "英语口语", cardCount: 5, createdAt: "2026-10-30T00:00:00Z" }),
  deck({ materialId: "m-orphan", materialTitle: "孤儿材料.md", cardCount: 3, createdAt: "2026-10-29T00:00:00Z" }),
];

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function hubHandlers(decks: EchoFixture[]): LooseHandlers {
  return {
    FlashcardDecksHub: () => decks,
    Tasks: () => tasks,
  };
}

function renderFlashcardsPage(handlers: LooseHandlers) {
  const client = createStubClient(handlers as Record<string, (variables: Record<string, unknown>) => unknown>, {
    sessions: [],
    evidence: [],
    mistakes: [],
    plans: [],
  });
  const Wrapper = makeStubWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter>
        <LanguageProvider>
          <FlashcardsPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("FlashcardsPage — the hub re-point (FR-41, epic P2-09 T4)", () => {
  it("renders every deck from the hub: title, origin chips, card count, created date — and the header carries the real count", async () => {
    renderFlashcardsPage(hubHandlers(hubDecks));

    expect(await screen.findByText("复习讲义.md")).toBeTruthy();
    expect(screen.getByText("网络笔记.md")).toBeTruthy();
    expect(screen.getByText("Lecture05.pdf")).toBeTruthy();
    // the origin-less deck renders its own unattached section: the material
    // title is the section title AND the row title (2 occurrences + the filter
    // option = 3)
    expect(screen.getAllByText("孤儿材料.md")).toHaveLength(3);

    // card counts render ({n} 张卡, the dictionary as the independent source)
    expect(screen.getByText(zhVars("flashcards.hub.cardCount", { n: 12 }))).toBeTruthy();
    expect(screen.getByText(zhVars("flashcards.hub.cardCount", { n: 8 }))).toBeTruthy();

    // origin chips: plan titles ride the wire and render thrice each (the
    // filter option, the section header, the row chip); the task title
    // resolves off the tasks read the same three ways (the MistakesPage
    // convention — its node title)
    expect(screen.getAllByText("软工备考")).toHaveLength(3);
    expect(screen.getAllByText("英语口语")).toHaveLength(3);
    expect(screen.getAllByText("TCP 拥塞控制")).toHaveLength(3);

    // header count = every row, including the origin-less one (the hub is honest)
    expect(screen.getByText(zhVars("flashcards.hub.subtitle", { n: 4 }))).toBeTruthy();

    // created dates render (locale formatting of the deck material's timestamp)
    expect(screen.getByText(new Date("2026-11-01T00:00:00Z").toLocaleDateString("zh-CN"))).toBeTruthy();
  });

  it("study links are honest per origin kind: plan decks → the plan flow, task decks → the task flow", async () => {
    renderFlashcardsPage(hubHandlers(hubDecks));

    expect(await screen.findByText("复习讲义.md")).toBeTruthy();

    const links = screen.getAllByRole("link", { name: new RegExp(zh("flashcards.hub.study")) });
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/plan/${PLAN_1}/flashcards`);
    expect(hrefs).toContain(`/plan/${PLAN_2}/flashcards`);
    expect(hrefs).toContain(`/task/${TASK_1}/flashcards`);
    expect(hrefs).toHaveLength(3); // the origin-less deck has NO study action
  });

  it("a deck with no origin renders without a study action — the attach contract violated in data degrades honestly", async () => {
    renderFlashcardsPage(hubHandlers([deck({ materialId: "m-orphan", materialTitle: "孤儿材料.md", cardCount: 3 })]));

    // the unattached section renders the title thrice (option, header, row) —
    // with NO kind chip and NO study link
    expect((await screen.findAllByText("孤儿材料.md")).length).toBe(3);
    expect(screen.queryByText(zh("flashcards.hub.kindPlan"))).toBeNull();
    expect(screen.queryByRole("link", { name: new RegExp(zh("flashcards.hub.study")) })).toBeNull();
  });

  it("groups by plan/task with kind chips, and the filter narrows to one origin", async () => {
    renderFlashcardsPage(hubHandlers(hubDecks));

    expect(await screen.findByText("复习讲义.md")).toBeTruthy();

    // group headers carry the kind chip
    expect(screen.getByRole("button", { name: "软工备考" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "TCP 拥塞控制" })).toBeTruthy();
    expect(screen.getAllByText(zh("flashcards.hub.kindPlan"))).toHaveLength(2);
    expect(screen.getByText(zh("flashcards.hub.kindTask"))).toBeTruthy();

    // filter to the task → only its deck
    const picker = screen.getByRole("combobox", { name: zh("flashcards.hub.filterLabel") }) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: `task:${TASK_1}` } });
    expect(screen.getByText("网络笔记.md")).toBeTruthy();
    expect(screen.queryByText("复习讲义.md")).toBeNull();
    expect(screen.queryByText("Lecture05.pdf")).toBeNull();

    // filter to plan-2 → only its deck
    fireEvent.change(picker, { target: { value: `plan:${PLAN_2}` } });
    expect(screen.getByText("Lecture05.pdf")).toBeTruthy();
    expect(screen.queryByText("网络笔记.md")).toBeNull();

    // back to all
    fireEvent.change(picker, { target: { value: "" } });
    expect(screen.getByText("复习讲义.md")).toBeTruthy();
    expect(screen.getByText("网络笔记.md")).toBeTruthy();
  });

  it("folds a group section and its decks leave the DOM", async () => {
    renderFlashcardsPage(hubHandlers(hubDecks));

    expect(await screen.findByText("复习讲义.md")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "软工备考" }));
    expect(screen.queryByText("复习讲义.md")).toBeNull();
    expect(screen.getByText("网络笔记.md")).toBeTruthy();
  });

  it("empty hub → the honest empty state (never a demo fallback)", async () => {
    renderFlashcardsPage(hubHandlers([]));

    expect(await screen.findByText(zh("flashcards.hub.emptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("flashcards.hub.emptyBody"))).toBeTruthy();
    expect(screen.queryByText("复习讲义.md")).toBeNull();

    // demo residue absent: the RETIRED fixture prompts never render again (the
    // fixture is gone — the independent source)
    expect(screen.queryByText("集成测试与单元测试的边界在哪里？")).toBeNull();
    expect(screen.queryByText("什么是需求可追溯性？")).toBeNull();
    expect(screen.queryByText("观察者模式解决什么问题？")).toBeNull();
  });

  it("renders nothing while the hub read is loading (honest-empty, no flash of stale demo copy)", () => {
    const { container } = renderFlashcardsPage(hubHandlers(hubDecks));
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(zh("flashcards.hub.emptyTitle"))).toBeNull();
  });

  it("the no-residue audit: the page carries no demo fixture, and demo-data no longer exports FLASHCARDS (nor the flash.* copy)", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/FlashcardsPage.tsx"), "utf8");
    for (const banned of ["demo-data", "FLASHCARDS", "pickL", "useUserProgress", "reviewFlashcard"]) {
      expect(page, `FlashcardsPage.tsx must not contain ${banned}`).not.toContain(banned);
    }
    const demoData = readFileSync(resolve(process.cwd(), "src/lib/demo-data.ts"), "utf8");
    expect(demoData).not.toContain("FLASHCARDS");
    expect(demoData).not.toContain("Flashcard");
  });
});

/**
 * The /planner re-point tests (FR-27, epic P2-09 T3): the retained page
 * consumes ONLY the todayHub read model plus the consistency series (the
 * week strip's honest 14-day source). The day's due reviews render per
 * schedulable kind with their study-flow deep links (mistake → re-quiz the
 * node / the task's quiz route / the mistakes-hub fallback; flashcard → the
 * task's or plan's deck flow / the flashcards-hub fallback — the flow IS the
 * completion, there is no inline review toggle), the manual tasks support
 * add / complete-toggle / delete with the todayHub read-back sweep after
 * every op, the suggestion slot deep-links 节点快测 with the partial-v1
 * flag, and the label rule holds: zh 今日学习, en Today (学习计划 stays
 * reserved for Study Plans). The demo fixtures (DEFAULT_TASKS + the
 * planner.task* keys) retired with the page — asserted by the fixture copy
 * never rendering again (the independent source).
 *
 * Apollo-level stub (the harness double): handlers answer the hub read, the
 * consistency read, the streak, and the three manual-task mutations with
 * wire-shaped fixtures; the mutation handlers mutate the captured fixture
 * arrays so the read-back sweep (refetchQueries) is observable in the DOM.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { HubDueItemView } from "@/api";
import { utcDayKey } from "@/domain/today-week";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import PlannerPage, { dueItemHref } from "./PlannerPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const NOW = "2026-11-01T00:00:00Z";
const PLAN_1 = "plan-1";
const PLAN_2 = "plan-2";
const TASK_1 = "task-1";
const NODE_1 = "node-1"; // plan-1's weak node
const NODE_2 = "node-2"; // plan-2's weak node
const TASK_NODE = "task-node-1"; // task-1's auto-owned node
const MAT_MD = "m-md";

/** Today's UTC day key — the week strip pins to the real clock (Mastery's
 * utc_day_key convention), so the fixtures derive from it too. */
const todayKey = new Date().toISOString().slice(0, 10);
/** The Monday UTC key of the current week (today − (cwday−1)). */
const monday = new Date(`${todayKey}T00:00:00Z`);
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const dayKey = (offsetFromMonday: number) => {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + offsetFromMonday);
  return d.toISOString().slice(0, 10);
};

const dueItem = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "DueItem",
  itemType: "mistake",
  itemId: "me-x",
  dueAt: NOW,
  stage: 0,
  title: "题干",
  nodeId: null,
  planId: null,
  taskId: null,
  materialId: MAT_MD,
  questionId: null,
  sourceLocation: null,
  ...over,
});

const manualTask = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "ManualTask",
  id: "mt-x",
  title: "任务",
  dueDate: null,
  done: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

/** The due matrix: every schedulable-kind × context combination gets its
 * honest deep-link target (the flow IS the completion — no inline toggle). */
const dueRows: EchoFixture[] = [
  dueItem({ itemType: "mistake", itemId: "me-plan", title: "集成测试的主要目的是什么？", stage: 2, nodeId: NODE_1, planId: PLAN_1 }),
  dueItem({ itemType: "mistake", itemId: "me-task", title: "TCP 慢启动从多大的窗口开始？", taskId: TASK_1, nodeId: TASK_NODE }),
  dueItem({ itemType: "mistake", itemId: "me-loose", title: "无主错题（节点已删）" }),
  dueItem({ itemType: "flashcard", itemId: "fc-task", title: "什么是需求可追溯性？", taskId: TASK_1 }),
  dueItem({ itemType: "flashcard", itemId: "fc-plan", title: "观察者模式解决什么问题？", planId: PLAN_2, nodeId: NODE_2 }),
  dueItem({ itemType: "flashcard", itemId: "fc-loose", title: "无主闪卡" }),
];

const suggestions: EchoFixture[] = [
  { __typename: "TodaySuggestion", planId: PLAN_1, planTitle: "软工备考", nodeId: NODE_1, nodeTitle: "集成测试策略" },
];

/** The captured manual rows — the mutation handlers mutate this array so the
 * todayHub read-back sweep is observable in the DOM. Reset per test (the
 * handlers close over the array identity). */
const manualRows: EchoFixture[] = [];

beforeEach(() => {
  manualRows.splice(
    0,
    manualRows.length,
    manualTask({ id: "mt-1", title: "整理需求追踪矩阵", dueDate: "2026-11-06T00:00:00+00:00" }),
    manualTask({ id: "mt-2", title: "给错题本写两周复盘" }),
  );
});

const summary = { __typename: "TodaySummary", dueCount: 6, manualCount: 2, doneCount: 1 };

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function hubHandlers(): LooseHandlers {
  return {
    TodayHub: () => ({
      __typename: "TodayHub",
      due: dueRows,
      suggestions,
      manual: manualRows.filter((row) => !row.done),
      summary: {
        ...summary,
        manualCount: manualRows.filter((row) => !row.done).length,
        doneCount: summary.doneCount + manualRows.filter((row) => row.done).length,
      },
    }),
    TodayConsistency: () => ({
      __typename: "AnalyticsSeries",
      consistency: [
        { __typename: "ConsistencyPoint", day: dayKey(0), sessionCount: 2 },
        { __typename: "ConsistencyPoint", day: dayKey(1), sessionCount: 1 },
        { __typename: "ConsistencyPoint", day: dayKey(2), sessionCount: 0 },
        // dayKey(3..6) unnamed → outside the consistency window → no-data
      ],
    }),
    Streak: () => 4,
    AddManualTask: (variables) => {
      const input = variables.input as { title: string; dueDate: string | null };
      const row = manualTask({ id: `mt-echo-${manualRows.length + 1}`, title: input.title, dueDate: input.dueDate });
      manualRows.push(row);
      return { __typename: "AddManualTaskPayload", manualTask: row };
    },
    SetManualTaskDone: (variables) => {
      const input = variables.input as { id: string; done: boolean };
      const row = manualRows.find((r) => r.id === input.id);
      if (!row) throw new Error("not found: manual task");
      row.done = input.done;
      return { __typename: "SetManualTaskDonePayload", manualTask: { ...row } };
    },
    DeleteManualTask: (variables) => {
      const input = variables.input as { id: string };
      const index = manualRows.findIndex((r) => r.id === input.id);
      if (index < 0) throw new Error("not found: manual task");
      manualRows.splice(index, 1);
      return { __typename: "DeleteManualTaskPayload", deletedManualTaskId: input.id };
    },
  };
}

function renderPlannerPage(handlers: LooseHandlers) {
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
          <PlannerPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("PlannerPage — the 今日学习 hub re-point (FR-27, epic P2-09 T3)", () => {
  it("holds the label rule in the dictionary AND on the page: zh 今日学习 / en Today; 学习计划 stays Study Plans", async () => {
    // the dictionary is the independent source
    expect(zh("planner.eyebrow")).toBe("今日学习");
    expect(zh("nav.planner")).toBe("今日学习");
    expect(enDict["planner.eyebrow"]).toBe("Today");
    expect(enDict["nav.planner"]).toBe("Today");
    expect(zh("nav.plans")).toBe("学习计划"); // reserved for Study Plans
    expect(enDict["nav.plans"]).toBe("Study Plans");

    renderPlannerPage(hubHandlers());
    // the page head carries the literal label (zh is the default language)
    expect(await screen.findByText("今日学习")).toBeTruthy();
    expect(screen.queryByText("学习计划")).toBeNull(); // the page never aliases the front door's label
  });

  it("renders every due review from the hub: prompt / front title, kind chips, the mistake ladder stage", async () => {
    renderPlannerPage(hubHandlers());

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从多大的窗口开始？")).toBeTruthy();
    expect(screen.getByText("无主错题（节点已删）")).toBeTruthy();
    expect(screen.getByText("什么是需求可追溯性？")).toBeTruthy();
    expect(screen.getByText("观察者模式解决什么问题？")).toBeTruthy();
    expect(screen.getByText("无主闪卡")).toBeTruthy();

    // kind chips: 3 mistakes + 3 flashcards (each chip renders twice per row set)
    expect(screen.getAllByText(zh("planner.dueKindMistake"))).toHaveLength(3);
    expect(screen.getAllByText(zh("planner.dueKindFlashcard"))).toHaveLength(3);
    // the ladder stage renders on mistakes (stage 2), never on flashcards (stage 0)
    expect(screen.getByText(zhVars("planner.dueStage", { n: 2 }))).toBeTruthy();
    expect(screen.queryByText(zhVars("planner.dueStage", { n: 0 }))).toBeNull();
  });

  it("deep-links each due review per its schedulable kind into the flow that completes it", async () => {
    renderPlannerPage(hubHandlers());

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    // mistake, plan context → the node-scoped quick-test loop (produces evidence)
    expect(hrefs).toContain(`/plan/${PLAN_1}/quiz?nodeId=${NODE_1}`);
    // mistake, task context → the task's quiz route (its material IS the scope)
    expect(hrefs).toContain(`/task/${TASK_1}/quiz`);
    // mistake, no context → the mistakes hub (the honest anchor fallback)
    expect(hrefs).toContain("/mistakes");
    // flashcard, task context → the task's deck flow
    expect(hrefs).toContain(`/task/${TASK_1}/flashcards`);
    // flashcard, plan context → the plan's deck flow
    expect(hrefs).toContain(`/plan/${PLAN_2}/flashcards`);
    // flashcard, no context → the flashcards hub
    expect(hrefs).toContain("/flashcards");
  });

  it("renders the suggestion slot: plan + weakest node, the 节点快测 deep link, the partial-v1 flag", async () => {
    renderPlannerPage(hubHandlers());

    expect(await screen.findByText("软工备考")).toBeTruthy();
    expect(screen.getByText("集成测试策略")).toBeTruthy();
    expect(screen.getByText(zh("planner.suggestionFlag"))).toBeTruthy();
    expect(zh("planner.suggestionFlag")).toBe("按掌握度推荐 · v1");
    expect(enDict["planner.suggestionFlag"]).toBe("Mastery-led · v1");

    const cta = screen.getByRole("link", { name: zhVars("planner.suggestionCtaAria", { node: "集成测试策略" }) });
    expect(cta.getAttribute("href")).toBe(`/plan/${PLAN_1}/quiz?nodeId=${NODE_1}`);
  });

  it("adds a manual task through the form and the read-back sweep renders it (wire round-trip proven by the DOM)", async () => {
    renderPlannerPage(hubHandlers());

    const input = await screen.findByPlaceholderText(zh("planner.addTitlePlaceholder"));
    fireEvent.change(input, { target: { value: "给错题本做一轮重练" } });
    fireEvent.click(screen.getByRole("button", { name: zh("planner.addSubmit") }));

    // the row appears ONLY through the todayHub refetch (the mutation echo
    // alone never renders — the page reads the hub list)
    expect(await screen.findByText("给错题本做一轮重练")).toBeTruthy();
    expect(manualRows.find((row) => row.title === "给错题本做一轮重练")).toBeTruthy();
  });

  it("completes a manual task in place; the read-back sweeps it out of the open list into the done count", async () => {
    renderPlannerPage(hubHandlers());

    expect(await screen.findByText("整理需求追踪矩阵")).toBeTruthy();
    const row = screen.getByText("整理需求追踪矩阵").closest("div.flex") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: zh("planner.markDone") }));

    // the summary's done count climbs through the refetch — await the CHANGE
    // (the other row is present from the first paint, so it proves nothing)
    await screen.findByText(zhVars("planner.doneCount", { n: 2 }));
    // the open list loses the row (manual lists open tasks only — T1's shape)
    expect(screen.queryByText("整理需求追踪矩阵")).toBeNull();
  });

  it("deletes a manual task; the read-back sweep empties it from the list", async () => {
    renderPlannerPage(hubHandlers());

    expect(await screen.findByText("整理需求追踪矩阵")).toBeTruthy();
    for (const title of ["整理需求追踪矩阵", "给错题本写两周复盘"]) {
      const row = screen.getByText(title).closest("div.flex") as HTMLElement;
      fireEvent.click(within(row).getByRole("button", { name: zhVars("planner.deleteTaskAria", { title }) }));
    }

    // both rows leave through the refetch — the honest manual-empty copy
    expect(await screen.findByText(zh("planner.manualEmpty"))).toBeTruthy();
    expect(screen.queryByText("整理需求追踪矩阵")).toBeNull();
    expect(screen.queryByText("给错题本写两周复盘")).toBeNull();
  });

  it("renders the day summary counts and the week strip from consistency: evidence days count, quiet days hollow, no-data days dashed, today highlighted", async () => {
    const { container } = renderPlannerPage(hubHandlers());

    expect(await screen.findByText(zhVars("planner.summaryDue", { n: 6 }))).toBeTruthy();
    expect(screen.getByText(zhVars("planner.summaryManual", { n: 2 }))).toBeTruthy();
    expect(screen.getByText(zhVars("planner.doneCount", { n: 1 }))).toBeTruthy();

    // all 7 weekday labels render, Monday-first
    for (const key of ["planner.weekdayMon", "planner.weekdayTue", "planner.weekdayWed", "planner.weekdayThu", "planner.weekdayFri", "planner.weekdaySat", "planner.weekdaySun"]) {
      expect(screen.getByText(zh(key))).toBeTruthy();
    }

    // the strip cells: 2 evidence (counts shown), 1 quiet (hollow), 4 no-data
    // (dashed) — future days of the week sit outside the 14-day window
    const cells = Array.from(container.querySelectorAll('[aria-label="' + zh("planner.weekStripAria") + '"] .grid > div > span:last-child'));
    const classes = cells.map((cell) => cell.className);
    expect(classes.filter((c) => c.includes("bg-gradient-to-r"))).toHaveLength(2); // evidence
    expect(classes.filter((c) => c.includes("border-dashed"))).toHaveLength(4); // no-data
    expect(classes.filter((c) => c.includes("ring-2"))).toHaveLength(1); // today highlighted
    expect(screen.getByText("2")).toBeTruthy(); // the evidence session count renders
  });

  it("empty hub → the honest empty state (never a demo fallback)", async () => {
    renderPlannerPage({
      TodayHub: () => ({ __typename: "TodayHub", due: [], suggestions: [], manual: [], summary: { __typename: "TodaySummary", dueCount: 0, manualCount: 0, doneCount: 0 } }),
      TodayConsistency: () => ({ __typename: "AnalyticsSeries", consistency: [] }),
      Streak: () => 0,
    });

    expect(await screen.findByText(zh("planner.emptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("planner.emptyBody"))).toBeTruthy();
    expect(screen.queryByText("复习「集成测试」错题")).toBeNull();

    // demo residue absent: the RETIRED fixture copy never renders again
    expect(screen.queryByText("25 分钟")).toBeNull();
    expect(screen.queryByText(/薄弱主题/)).toBeNull();
    expect(screen.queryByText("设计模式 8 张")).toBeNull();
  });

  it("renders nothing while the hub reads are loading (honest-empty, no flash of stale demo copy)", () => {
    const { container } = renderPlannerPage(hubHandlers());
    // the stub link resolves on the next tick — the first paint waits
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(zh("planner.emptyTitle"))).toBeNull();
  });
});

describe("dueItemHref — the honest per-kind link matrix (pure seam)", () => {
  // mapped-view shape (the hook's HubDueItemView), not the raw wire fixture
  const item = (over: Partial<HubDueItemView>): HubDueItemView => ({
    kind: "mistake",
    itemId: "x",
    dueAt: NOW,
    stage: 0,
    title: "题干",
    nodeId: null,
    planId: null,
    taskId: null,
    materialId: null,
    questionId: null,
    sourceLocation: null,
    ...over,
  });

  it("routes mistakes: task quiz route → plan quick-test loop → the mistakes hub fallback", () => {
    expect(dueItemHref(item({ kind: "mistake", taskId: "t9" }))).toBe("/task/t9/quiz");
    expect(dueItemHref(item({ kind: "mistake", planId: "p9", nodeId: "n9" }))).toBe("/plan/p9/quiz?nodeId=n9");
    expect(dueItemHref(item({ kind: "mistake" }))).toBe("/mistakes");
  });

  it("routes flashcards: task deck flow → plan deck flow → the flashcards hub fallback", () => {
    expect(dueItemHref(item({ kind: "flashcard", taskId: "t9" }))).toBe("/task/t9/flashcards");
    expect(dueItemHref(item({ kind: "flashcard", planId: "p9" }))).toBe("/plan/p9/flashcards");
    expect(dueItemHref(item({ kind: "flashcard" }))).toBe("/flashcards");
  });

  it("breaks loudly on an unknown schedulable kind (a contract break, not a guess)", () => {
    // the out-of-contract value is the point — the cast builds it
    const broken = { ...item({}), kind: "note" as HubDueItemView["kind"] };
    expect(() => dueItemHref(broken)).toThrow();
  });
});

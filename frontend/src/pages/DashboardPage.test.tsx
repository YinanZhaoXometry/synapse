/**
 * The /dashboard re-point tests (FR-25, epic P2-09 T5): the page renders plan
 * evidence — the time-of-day greeting, the SERVER streak (the T3 precedent),
 * KPI cards from real reads (plans + their nodes' mastery, this week's
 * sessions vs the weekly goal, the mistakes-hub count — each card deep-links
 * its hub), the weekly goal ring honest on partial weeks (current ISO week
 * sessions / target — never a projection), plan-first quick actions on real
 * routes, and the recent-unlocked badges summary from badgeState (real "none
 * yet" empty state — the demo ACHIEVEMENTS unlocks retire). UserProgressContext
 * is gone from the page (the retirement progresses; the context dies in T6).
 *
 * Apollo-level stub (the harness double): handlers answer the Plans list, the
 * analytics series, the weekly goal, the streak, the mistakes hub, and the
 * badge states with wire-shaped fixtures.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import DashboardPage, { greetingKey } from "./DashboardPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const PAGE_SOURCE = readFileSync(join(__dirname, "DashboardPage.tsx"), "utf8");

const PLAN_1 = "plan-1";

const plansFixture: EchoFixture[] = [
  { __typename: "StudyPlan", id: PLAN_1, topic: "软工备考", goal: "期末复习", createdAt: "2026-10-20T00:00:00Z", masteryScore: "64" },
  { __typename: "StudyPlan", id: "plan-2", topic: "网络期末", goal: "刷完习题", createdAt: "2026-10-25T00:00:00Z", masteryScore: "21" },
];

const seriesFixture: EchoFixture = {
  __typename: "AnalyticsSeries",
  nodeMastery: [
    { __typename: "NodeMasteryEntry", nodeId: "n1", nodeTitle: "甲", planId: PLAN_1, masteryScore: "80", state: "mastered" },
    { __typename: "NodeMasteryEntry", nodeId: "n2", nodeTitle: "乙", planId: PLAN_1, masteryScore: "40", state: "partial" },
    { __typename: "NodeMasteryEntry", nodeId: "n3", nodeTitle: "丙", planId: "plan-2", masteryScore: "0", state: "uncovered" },
  ],
  weeklyAccuracy: [],
  consistency: [],
};

/** Wire-complete mistake rows (the hub op selects the full entry — the cache
 * writes every selected field). */
const mistakeRow = (id: string): EchoFixture => ({
  __typename: "MistakeEntry",
  id,
  questionId: `q-${id}`,
  sessionId: null,
  nodeId: "n1",
  planId: PLAN_1,
  taskId: null,
  materialId: "m-1",
  userAnswer: "",
  sourceLocation: { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "s-1" },
  forfeited: false,
  createdAt: "2026-11-01T00:00:00Z",
  question: { __typename: "Question", prompt: "题干", kind: "choice", options: ["甲", "乙"] },
});

const mistakesFixture: EchoFixture[] = [mistakeRow("me-1"), mistakeRow("me-2")];

const badgesFixture = (unlockedIds: string[]): EchoFixture[] =>
  ["b1", "b2", "b3", "b4", "b5"].map((id) => ({
    __typename: "BadgeState",
    id,
    unlocked: unlockedIds.includes(id),
    counter: unlockedIds.includes(id) ? 9 : 1,
    threshold: 3,
  }));

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function dashHandlers(over: {
  plans?: EchoFixture[];
  weeklyGoal?: EchoFixture;
  streak?: number;
  mistakes?: EchoFixture[];
  badges?: EchoFixture[];
  nodeMastery?: EchoFixture[];
} = {}): LooseHandlers {
  return {
    // the list root returns the ARRAY (the harness wraps it under `plans`)
    Plans: () => over.plans ?? plansFixture,
    AnalyticsSeries: () => ({
      __typename: "AnalyticsSeries",
      nodeMastery: over.nodeMastery ?? seriesFixture.nodeMastery,
      weeklyAccuracy: [],
      consistency: [],
    }),
    WeeklyGoal: () => over.weeklyGoal ?? { __typename: "WeeklyGoal", target: 5, currentWeekSessions: 2, currentWeekStart: "2026-11-02" },
    Streak: () => over.streak ?? 4,
    MistakesHub: () => over.mistakes ?? mistakesFixture,
    BadgeStates: () => over.badges ?? badgesFixture(["b1", "b4"]),
  };
}

function renderDashboardPage(handlers: LooseHandlers) {
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
          <DashboardPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("greetingKey — the time-of-day greeting (pure seam)", () => {
  it("morning before noon, afternoon until 18:00, evening after", () => {
    expect(greetingKey(0)).toBe("dashboard.greetingMorning");
    expect(greetingKey(5)).toBe("dashboard.greetingMorning");
    expect(greetingKey(11)).toBe("dashboard.greetingMorning");
    expect(greetingKey(12)).toBe("dashboard.greetingAfternoon");
    expect(greetingKey(17)).toBe("dashboard.greetingAfternoon");
    expect(greetingKey(18)).toBe("dashboard.greetingEvening");
    expect(greetingKey(23)).toBe("dashboard.greetingEvening");
  });

  it("is bilingual: three distinct zh greetings with en counterparts", () => {
    for (const key of ["dashboard.greetingMorning", "dashboard.greetingAfternoon", "dashboard.greetingEvening"]) {
      expect(zhDict[key]).toBeTruthy();
      expect(enDict[key]).toBeTruthy();
      expect(zhDict[key]).not.toBe(enDict[key]);
    }
  });
});

describe("DashboardPage — plan evidence re-point (FR-25, epic P2-09 T5)", () => {
  it("renders a time-of-day greeting (one of the three dictionary greetings) with the streak pill from the SERVER hook", async () => {
    renderDashboardPage(dashHandlers());

    const greetings = ["dashboard.greetingMorning", "dashboard.greetingAfternoon", "dashboard.greetingEvening"].map(zh);
    const greeting = await screen.findByText((_, element) => element?.tagName === "H1" && greetings.some((g) => element.textContent?.includes(g)));
    expect(greeting).toBeTruthy();

    expect(screen.getByText(zhVars("dashboard.streak", { n: 4 }))).toBeTruthy();
  });

  it("renders the KPI cards from real reads and deep-links each to its hub", async () => {
    renderDashboardPage(dashHandlers());

    // 学习计划: 2 plans; the nodes' mastered count rides the series (1 of 3)
    const plansCard = await screen.findByTestId("kpi-plans");
    expect(within(plansCard).getByText("2")).toBeTruthy();
    expect(within(plansCard).getByText(zhVars("dashboard.kpiPlansSub", { mastered: 1, total: 3 }))).toBeTruthy();
    // the card IS its hub link
    expect(plansCard.tagName).toBe("A");
    expect(plansCard.getAttribute("href")).toBe("/plans");

    // 本周学习: 2 of 5 sessions (weeklyGoal)
    const weekCard = screen.getByTestId("kpi-week");
    expect(within(weekCard).getByText(zhVars("dashboard.kpiWeekValue", { done: 2, target: 5 }))).toBeTruthy();
    expect(weekCard.getAttribute("href")).toBe("/planner");

    // 连续记录: the server streak — its hub is /analytics (one KPI, one hub;
    // 本周学习 is the card that owns /planner, epic-25 T4 audit #12)
    const streakCard = screen.getByTestId("kpi-streak");
    expect(within(streakCard).getByText(zhVars("dashboard.kpiStreakValue", { n: 4 }))).toBeTruthy();
    expect(streakCard.getAttribute("href")).toBe("/analytics");

    // 错题本: the mistakes-hub length
    const mistakesCard = screen.getByTestId("kpi-mistakes");
    expect(within(mistakesCard).getByText("2")).toBeTruthy();
    expect(mistakesCard.getAttribute("href")).toBe("/mistakes");
  });

  it("renders the weekly goal ring honest on a partial week: current/target from weeklyGoal, percent capped, no projection", async () => {
    const { container } = renderDashboardPage(dashHandlers());

    // the current/target sub renders (visible copy + the ring's aria label)
    const subs = await screen.findAllByText(zhVars("dashboard.ringSub", { done: 2, target: 5 }));
    expect(subs.length).toBeGreaterThanOrEqual(1);
    const ring = container.querySelector('[data-testid="goal-ring"]');
    expect(ring).toBeTruthy();
    // 2/5 = 40% — the honest ratio of the CURRENT week so far
    expect(ring!.getAttribute("data-percent")).toBe("40");
    expect(screen.getByText("40%")).toBeTruthy();
  });

  it("caps the ring at 100% when the week overshoots the target (honest, never >100)", async () => {
    const { container } = renderDashboardPage(dashHandlers({ weeklyGoal: { __typename: "WeeklyGoal", target: 3, currentWeekSessions: 7, currentWeekStart: "2026-11-02" } }));

    const subs = await screen.findAllByText(zhVars("dashboard.ringSub", { done: 7, target: 3 }));
    expect(subs.length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[data-testid="goal-ring"]')!.getAttribute("data-percent")).toBe("100");
  });

  it("renders the plan-first quick actions on their real routes", async () => {
    renderDashboardPage(dashHandlers());

    // 创建学习计划 → the creation flow
    const plan = await screen.findByRole("link", { name: zh("dashboard.quickPlan") });
    expect(plan.getAttribute("href")).toBe("/plan/new");
    // 今日学习 — the label rule holds on the action too
    expect(zh("dashboard.quickToday")).toBe("今日学习");
    expect(enDict["dashboard.quickToday"]).toBe("Today");
    const today = screen.getByRole("link", { name: zh("dashboard.quickToday") });
    expect(today.getAttribute("href")).toBe("/planner");
    // 快速测验 → the quiz hub
    const quiz = screen.getByRole("link", { name: zh("dashboard.quickQuiz") });
    expect(quiz.getAttribute("href")).toBe("/quiz");
  });

  it("renders the recent-unlocked badges from badgeState (the server truth, not the demo unlocks)", async () => {
    renderDashboardPage(dashHandlers());

    // b1 + b4 unlocked server-side → their scaffold names render
    expect(await screen.findByText(zh("ach.b1"))).toBeTruthy();
    expect(screen.getByText(zh("ach.b4"))).toBeTruthy();
    // the demo fixture's unlocks must not leak (b2/b3/b5 are server-locked)
    expect(screen.queryByText(zh("ach.b2"))).toBeNull();
    expect(screen.queryByText(zh("ach.b3"))).toBeNull();
  });

  it("zero badges unlocked → the real none-yet empty state (never the demo fixture)", async () => {
    renderDashboardPage(dashHandlers({ badges: badgesFixture([]) }));

    expect(await screen.findByText(zh("dashboard.achievementsEmpty"))).toBeTruthy();
    expect(screen.getByText(zh("dashboard.achievementsEmptyBody"))).toBeTruthy();
    // the demo-fixture unlocks render nowhere
    expect(screen.queryByText(zh("ach.b1"))).toBeNull();
    expect(screen.queryByText(zh("ach.b6"))).toBeNull();
  });

  it("renders nothing while the reads load (honest-empty, no flash of stale demo copy)", () => {
    const { container } = renderDashboardPage(dashHandlers());
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(zh("common.loading"))).toBeTruthy();
    expect(screen.queryByText(zh("dashboard.achievementsEmpty"))).toBeNull();
  });

  it("the demo residue is gone: no continue-reading demo card, no demo minutes/level cards, no UserProgressContext/demo-data imports in the source", () => {
    expect(PAGE_SOURCE).not.toMatch(/UserProgressContext|useUserProgress/);
    expect(PAGE_SOURCE).not.toMatch(/demo-data/);
    expect(PAGE_SOURCE).not.toMatch(/ACHIEVEMENTS|fmtNum|DEFAULT_PROGRESS/);
    expect(PAGE_SOURCE).not.toMatch(/continueReading/);
  });
});

describe("dashboard i18n — zh/en parity for the re-point keys (AD-9)", () => {
  it("every new dashboard.* key exists in BOTH languages with non-empty copy", () => {
    const newKeys = Object.keys(zhDict).filter(
      (key) =>
        key.startsWith("dashboard.greeting") ||
        key.startsWith("dashboard.kpi") ||
        key.startsWith("dashboard.quickPlan") ||
        key.startsWith("dashboard.quickToday") ||
        key.startsWith("dashboard.achievements"),
    );
    expect(newKeys.length).toBeGreaterThanOrEqual(9);
    for (const key of newKeys) {
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
    const enOnly = Object.keys(enDict).filter(
      (key) =>
        key.startsWith("dashboard.greeting") ||
        key.startsWith("dashboard.kpi") ||
        key.startsWith("dashboard.quickPlan") ||
        key.startsWith("dashboard.quickToday") ||
        key.startsWith("dashboard.achievements"),
    );
    expect(enOnly.filter((key) => !newKeys.includes(key))).toEqual([]);
  });

  it("the retired demo keys are gone from the dictionary", () => {
    for (const key of [
      "dashboard.greetingA",
      "dashboard.greetingB",
      "dashboard.continueReading",
      "dashboard.continueReadingSub",
      "dashboard.readerToast",
      "dashboard.quickCards",
      "dashboard.quickMaterials",
      "dashboard.quickTutor",
      "dashboard.studyTime",
      "dashboard.levelLabel",
      "dashboard.weeklyGoalSub",
    ]) {
      expect(zhDict[key], `zh ${key} retired`).toBeUndefined();
      expect(enDict[key], `en ${key} retired`).toBeUndefined();
    }
  });
});

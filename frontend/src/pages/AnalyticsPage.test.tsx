/**
 * The /analytics re-point tests (FR-26, epic P2-09 T5): the page renders the
 * THREE server series and nothing else — mastery by knowledge node (per-node
 * bars ordered weakest-first, the NodeStateBadge state glyph + tint per node,
 * the raw server score% rendered verbatim), the weekly accuracy trend (the
 * scaffold's chart pattern kept, fed by weeklyAccuracy, week-start labels),
 * and the 14-day study-consistency strip (evidence days filled, zero days
 * hollow — honest no-data). The demo fixtures (TOPIC_ROWS / WEEK_VALUES /
 * ACCURACY_VALUES) retired with the re-point, the AI-vs-manual / minutes
 * charts stay excluded (SM-C3: sessions, never minutes), and
 * UserProgressContext is gone from the page (the retirement progresses; the
 * context file itself dies in T6).
 *
 * Apollo-level stub (the harness double): one handler answers AnalyticsSeries
 * with wire-shaped fixtures.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import AnalyticsPage from "./AnalyticsPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const PAGE_SOURCE = readFileSync(join(__dirname, "AnalyticsPage.tsx"), "utf8");

const nodeMastery = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "NodeMasteryEntry",
  nodeId: "n-x",
  nodeTitle: "节点",
  planId: "plan-1",
  masteryScore: "0",
  state: "uncovered",
  ...over,
});

const weekPoint = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "WeeklyAccuracyPoint",
  weekStart: "2026-10-05",
  correct: 0,
  answered: 0,
  ...over,
});

const consistencyDay = (day: string, sessionCount: number): EchoFixture => ({
  __typename: "ConsistencyPoint",
  day,
  sessionCount,
});

/** Today's UTC day key — the strip pins to the real clock (Mastery's
 * utc_day_key convention), so the fixtures derive from it too. */
const todayKey = new Date().toISOString().slice(0, 10);
const dayAt = (offset: number) => {
  const d = new Date(`${todayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** A populated series: three nodes whose DOM order must be weakest-first,
 * three evidence-carrying weeks, a 14-day consistency window with evidence /
 * quiet days side by side. */
function seriesHandlers(over: Record<string, EchoFixture> = {}): Record<string, () => unknown> {
  const series: EchoFixture = {
    __typename: "AnalyticsSeries",
    nodeMastery: [
      nodeMastery({ nodeId: "n-strong", nodeTitle: "集成测试策略", masteryScore: "82", state: "mastered" }),
      nodeMastery({ nodeId: "n-zero", nodeTitle: "需求获取方法", masteryScore: "0", state: "uncovered", planId: "plan-2" }),
      nodeMastery({ nodeId: "n-mid", nodeTitle: "等价类划分", masteryScore: "47", state: "partial" }),
      nodeMastery({ nodeId: "n-task", nodeTitle: "任务节点", masteryScore: "30", state: "partial", planId: null }),
    ],
    weeklyAccuracy: [
      weekPoint({ weekStart: "2026-09-28", correct: 6, answered: 10 }),
      weekPoint({ weekStart: "2026-10-05", correct: 8, answered: 10 }),
      weekPoint({ weekStart: "2026-10-12", correct: 3, answered: 4 }),
    ],
    consistency: Array.from({ length: 14 }, (_, i) =>
      consistencyDay(dayAt(i - 13), i === 5 ? 2 : i === 13 ? 1 : 0),
    ),
    ...over,
  };
  return { AnalyticsSeries: () => series };
}

function renderAnalyticsPage(handlers: Record<string, () => unknown>) {
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
          <AnalyticsPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("AnalyticsPage — the three real series (FR-26, epic P2-09 T5)", () => {
  it("renders mastery by knowledge node ordered WEAKEST-FIRST, with the raw server score% verbatim", async () => {
    const { container } = renderAnalyticsPage(seriesHandlers());

    // every node renders: title + raw server percent (the String convention)
    expect(await screen.findByText("需求获取方法")).toBeTruthy();
    expect(screen.getByText("等价类划分")).toBeTruthy();
    expect(screen.getByText("集成测试策略")).toBeTruthy();
    expect(screen.getByText("任务节点")).toBeTruthy();

    // the rows are the DOM order 0% → 30% → 47% → 82% (weakest first)
    const rows = Array.from(container.querySelectorAll('[data-testid="node-mastery-row"]'));
    expect(rows.map((row) => row.getAttribute("data-score"))).toEqual(["0", "30", "47", "82"]);

    // bar width carries the score (rendering reads the server value)
    const bars = rows.map((row) => row.querySelector('[data-testid="node-mastery-bar"]'));
    expect(bars[0]?.getAttribute("data-width")).toBe("0");
    expect(bars[3]?.getAttribute("data-width")).toBe("82");
  });

  it("renders the server state through the shared NodeStateBadge contract (glyph + tint + label per node)", async () => {
    renderAnalyticsPage(seriesHandlers());

    const badges = await screen.findAllByTestId("node-state-badge");
    expect(badges).toHaveLength(4);
    const states = badges.map((badge) => badge.getAttribute("data-state"));
    // one badge per node, state straight off the server fields
    expect(states.filter((s) => s === "mastered")).toHaveLength(1);
    expect(states.filter((s) => s === "partial")).toHaveLength(2);
    expect(states.filter((s) => s === "uncovered")).toHaveLength(1);
    // the badge announces its state (AD-9 never-color-only)
    expect(screen.getAllByRole("img", { name: zhVars("plans.nodeStateAria", { state: zh("plans.stateMastered") }) })).toHaveLength(1);
  });

  it("renders the weekly accuracy trend from weeklyAccuracy: accuracy per evidence-carrying week, week-start labels", async () => {
    const { container } = renderAnalyticsPage(seriesHandlers());

    // wait for the series to land (honest-empty until then)
    await screen.findByText("等价类划分");

    // per-week accuracy = correct/answered: 60%, 80%, 75% — rendered as real
    // data points (the scaffold's chart pattern kept, demo values gone)
    const chart = container.querySelector('[data-testid="weekly-accuracy-chart"]');
    expect(chart).toBeTruthy();
    const values = Array.from(chart!.querySelectorAll("[data-accuracy]")).map((el) => el.getAttribute("data-accuracy"));
    expect(values).toEqual(["60", "80", "75"]);
    // week start labels render (zh surface)
    const labels = Array.from(chart!.querySelectorAll("[data-weeklabel]")).map((el) => el.textContent);
    expect(labels).toEqual(["9/28", "10/5", "10/12"]);
  });

  it("renders the 14-day consistency strip honestly: evidence days filled with their session count, zero days hollow, today highlighted", async () => {
    const { container } = renderAnalyticsPage(seriesHandlers());

    // wait for the series to land (honest-empty until then)
    await screen.findByText("等价类划分");

    const strip = container.querySelector('[data-testid="consistency-strip"]');
    expect(strip).toBeTruthy();
    const cells = Array.from(strip!.querySelectorAll("[data-day]"));
    expect(cells).toHaveLength(14);

    const filled = cells.filter((cell) => cell.getAttribute("data-filled") === "true");
    expect(filled).toHaveLength(2);
    // the session counts render on the evidence days only (2 and 1)
    expect(filled.map((cell) => cell.textContent)).toEqual(["2", "1"]);
    // today is highlighted
    expect(cells.find((cell) => cell.getAttribute("data-day") === todayKey)?.getAttribute("data-today")).toBe("true");
    // zero days stay visible and hollow (a quiet day is still a day — no invention)
    expect(cells.filter((cell) => cell.getAttribute("data-filled") === "false")).toHaveLength(12);
  });

  it("empty series → the honest empty states (never a demo fallback)", async () => {
    renderAnalyticsPage(seriesHandlers({
      nodeMastery: [],
      weeklyAccuracy: [],
      consistency: Array.from({ length: 14 }, (_, i) => consistencyDay(dayAt(i - 13), 0)),
    }));

    expect(await screen.findByText(zh("analytics.nodeMasteryEmpty"))).toBeTruthy();
    expect(screen.getByText(zh("analytics.weeklyAccuracyEmpty"))).toBeTruthy();
    // the demo residue never renders again
    expect(screen.queryByText("可用性")).toBeNull();
    expect(screen.queryByText("软件设计")).toBeNull();
    expect(screen.queryByText(zh("common.demoData"))).toBeNull();
    expect(screen.queryByText("7.8 小时")).toBeNull();
  });

  it("keeps the AI-vs-manual / minutes charts excluded (SM-C3: sessions, never minutes)", async () => {
    renderAnalyticsPage(seriesHandlers());

    await screen.findByText("等价类划分");
    // the retired minutes/legacy keys are gone from the dictionary (nothing
    // can render them) and no minutes copy renders on the page
    for (const key of ["analytics.weekly", "analytics.chartWeekly", "analytics.chartNote", "dashboard.studyTime", "dashboard.levelLabel"]) {
      expect(zhDict[key], `${key} retired`).toBeUndefined();
    }
    expect(screen.queryByText("分钟")).toBeNull();
    expect(screen.queryByText(/小时/)).toBeNull();
  });

  it("the page consumes ONLY the analytics read: no UserProgressContext, no demo-data imports remain in the source", () => {
    expect(PAGE_SOURCE).not.toMatch(/UserProgressContext|useUserProgress/);
    expect(PAGE_SOURCE).not.toMatch(/demo-data/);
    expect(PAGE_SOURCE).not.toMatch(/TOPIC_ROWS|WEEK_VALUES|ACCURACY_VALUES/);
  });
});

describe("analytics i18n — zh/en parity for the re-point namespace (AD-9)", () => {
  it("every analytics.* key added by the re-point exists in BOTH languages with non-empty copy", () => {
    const rePointKeys = Object.keys(zhDict).filter((key) => key.startsWith("analytics."));
    expect(rePointKeys.length).toBeGreaterThan(0);
    for (const key of rePointKeys) {
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
    }
    // set equality, both directions
    const enKeys = Object.keys(enDict).filter((key) => key.startsWith("analytics."));
    expect(enKeys.filter((key) => !rePointKeys.includes(key))).toEqual([]);
  });

  it("the retired demo copy is gone from the dictionary", () => {
    expect(zhDict["analytics.subtitle"]).not.toContain("演示");
    expect(enDict["analytics.subtitle"]).not.toContain("Demo");
    // the demo-fixture keys retire with the fixtures
    for (const key of [
      "analytics.weekly",
      "analytics.weeklyVal",
      "analytics.answers",
      "analytics.nodes",
      "analytics.chartWeekly",
      "analytics.chartWeeklySub",
      "analytics.chartNote",
      "analytics.topicUsability",
      "analytics.topicCognition",
      "analytics.topicDesign",
      "analytics.topicRequirements",
      "analytics.topicTesting",
      "analytics.quizLabel",
    ]) {
      expect(zhDict[key], `zh ${key} retired`).toBeUndefined();
      expect(enDict[key], `en ${key} retired`).toBeUndefined();
    }
  });
});

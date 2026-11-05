/**
 * The /mistakes re-point tests (FR-23, epic P2-09 T2): the retained page
 * consumes ONLY the mistakesHub read model (T1's aggregation) — every wrong
 * answer (Choice + Open) renders with its question prompt, the user's answer
 * (the chosen option text for Choice, the typed answer for Open), the source
 * material + locator as a deep link through the REAL AD-8 anchor channel, the
 * node chip, the log date, and its re-quiz launch (plan flow ?nodeId= / the
 * task's quiz route). Grouping (plan sections + task sections) and the
 * plan/task filter are client rendering over the flat list — the read model
 * stays flat. The Phase-1 demo fixture (MISTAKES) retires with the page —
 * asserted by the fixture copy never rendering again (the independent
 * source).
 *
 * Apollo-level stub (the harness double): handlers answer the hub read plus
 * the label-lookup list reads (materials/plans/tasks + the per-plan node
 * reads) with wire-shaped factory fixtures.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import MistakesPage from "./MistakesPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const NOW = "2026-11-01T00:00:00Z";
const PLAN_1 = "plan-1";
const PLAN_2 = "plan-2";
const TASK_1 = "task-1";
const NODE_1 = "node-1"; // plan-1's mistaken node
const NODE_2 = "node-2"; // plan-2's mistaken node
const TASK_NODE = "task-node-1"; // task-1's auto-owned node
const MAT_MD = "m-md";
const MAT_PDF = "m-pdf";
const MAT_TASK = "m-task-md";

const material = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "Material",
  id: "m-x",
  title: "材料",
  kind: "markdown",
  sizeBytes: 64,
  planId: null,
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: NOW,
  downloadUrl: null,
  sections: [],
  ...over,
});

const node = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "KnowledgeNode",
  id: "n-x",
  planId: null,
  taskId: null,
  stage: "apply",
  title: "节点",
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  createdAt: NOW,
  ...over,
});

const materials: EchoFixture[] = [
  material({ id: MAT_MD, title: "复习讲义.md", planId: PLAN_1, sections: [{ __typename: "MaterialSection", id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" }] }),
  material({ id: MAT_PDF, title: "Lecture05.pdf", kind: "pdf", planId: PLAN_2 }),
  material({ id: MAT_TASK, title: "网络笔记.md", attachmentScope: "node", taskId: TASK_1, nodeId: TASK_NODE, sections: [{ __typename: "MaterialSection", id: "sec-cc", title: "拥塞控制", text: "慢启动从一个小窗口开始。" }] }),
];

const plans: EchoFixture[] = [
  { __typename: "StudyPlan", id: PLAN_1, topic: "软工备考", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
  { __typename: "StudyPlan", id: PLAN_2, topic: "英语口语", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
];

const tasks: EchoFixture[] = [
  { __typename: "StudyTask", id: TASK_1, materialId: MAT_TASK, nodeId: TASK_NODE, createdAt: NOW, node: node({ id: TASK_NODE, taskId: TASK_1, title: "TCP 拥塞控制" }) },
];

const planNodes: Record<string, EchoFixture[]> = {
  [PLAN_1]: [node({ id: NODE_1, planId: PLAN_1, title: "集成测试策略" })],
  [PLAN_2]: [node({ id: NODE_2, planId: PLAN_2, title: "连读弱读" })],
};

const entry = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "HubMistakeEntry",
  id: "me-x",
  questionId: "q-x",
  sessionId: "s-x",
  nodeId: "n-x",
  planId: null,
  taskId: null,
  materialId: MAT_MD,
  userAnswer: "",
  sourceLocation: { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "sec-1" },
  forfeited: false,
  createdAt: NOW,
  question: { __typename: "Question", prompt: "题干", kind: "open", options: null },
  ...over,
});

/** The factory hub graph (newest-first, server order): a Choice wrong on
 * plan-1, an Open wrong on plan-2, a forfeited Choice under task-1. */
const hubEntries: EchoFixture[] = [
  entry({
    id: "me-1",
    questionId: "q-1",
    sessionId: "s-1",
    nodeId: NODE_1,
    planId: PLAN_1,
    materialId: MAT_MD,
    userAnswer: "把单元测试一次跑完",
    createdAt: "2026-11-01T00:00:00Z",
    question: {
      __typename: "Question",
      prompt: "集成测试的主要目的是什么？",
      kind: "choice",
      options: ["验证模块间接口与协作", "把单元测试一次跑完", "替代单元测试"],
    },
  }),
  entry({
    id: "me-2",
    questionId: "q-2",
    sessionId: "s-2",
    nodeId: NODE_2,
    planId: PLAN_2,
    materialId: MAT_PDF,
    userAnswer: "变更时定位受影响的设计与测试",
    sourceLocation: { __typename: "ReadingLocator", kind: "pdf", page: 12, sectionId: null },
    createdAt: "2026-10-30T00:00:00Z",
    question: { __typename: "Question", prompt: "需求可追溯性最直接的用途是什么？", kind: "open", options: null },
  }),
  entry({
    id: "me-3",
    questionId: "q-3",
    sessionId: "s-3",
    nodeId: TASK_NODE,
    taskId: TASK_1,
    materialId: MAT_TASK,
    userAnswer: "",
    sourceLocation: { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "sec-cc" },
    forfeited: true,
    createdAt: "2026-10-29T00:00:00Z",
    question: { __typename: "Question", prompt: "TCP 慢启动从一个多大的窗口开始？", kind: "choice", options: ["1 MSS", "ssthresh", "整个带宽"] },
  }),
];

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function hubHandlers(entries: EchoFixture[]): LooseHandlers {
  return {
    MistakesHub: () => entries,
    Materials: () => materials,
    Plans: () => plans,
    Tasks: () => tasks,
    Plan: (variables) => {
      const rows = planNodes[variables.id as string];
      if (!rows) throw new Error("not found: plan"); // the api's honest NOT_FOUND
      const plan = plans.find((p) => p.id === variables.id);
      return { ...plan, nodes: rows, materials: materials.filter((m) => m.planId === variables.id) };
    },
  };
}

function renderMistakesPage(handlers: LooseHandlers) {
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
          <MistakesPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("MistakesPage — the hub re-point (FR-23, epic P2-09 T2)", () => {
  it("renders every wrong answer from the hub: prompt + user answer, Choice-option-text and Open paths, node chips, log dates", async () => {
    renderMistakesPage(hubHandlers(hubEntries));

    // all three entries render (prompts are the fixtures', not demo copy)
    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.getByText("需求可追溯性最直接的用途是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();

    // the Choice entry renders the CHOSEN OPTION's text (the runner stores the
    // option string); the Open entry renders the typed answer
    expect(screen.getByText("把单元测试一次跑完")).toBeTruthy();
    expect(screen.getByText("变更时定位受影响的设计与测试")).toBeTruthy();
    // the forfeited entry renders the honest forfeit label, not an empty box
    expect(screen.getByText(zh("mistakes.forfeited"))).toBeTruthy();

    // node chips resolve titles: plan nodes via the plan read, the task node
    // via the tasks read ("TCP 拥塞控制" renders thrice: the filter option,
    // the task section header, and the task entry's node chip)
    expect(screen.getByText("集成测试策略")).toBeTruthy();
    expect(screen.getByText("连读弱读")).toBeTruthy();
    expect(screen.getAllByText("TCP 拥塞控制")).toHaveLength(3);

    // log dates render (locale formatting of createdAt)
    expect(screen.getByText(new Date("2026-11-01T00:00:00Z").toLocaleDateString("zh-CN"))).toBeTruthy();

    // header carries the real count, not the demo copy
    expect(screen.getByText(zhVars("mistakes.subtitle", { n: 3 }))).toBeTruthy();
  });

  it("deep-links each entry's source through the REAL anchor channel hrefs (?hl=1; #section for markdown, ?page=N for pdf)", async () => {
    renderMistakesPage(hubHandlers(hubEntries));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    // markdown entry → #section-id + hl=1 (built by readerSectionHref)
    const mdLink = screen.getByRole("link", { name: /复习讲义\.md/ });
    expect(mdLink.getAttribute("href")).toBe(`/read/${MAT_MD}?hl=1#sec-1`);

    // pdf entry → ?page=N + hl=1 (built by readerAnchorHref)
    const pdfLink = screen.getByRole("link", { name: /Lecture05\.pdf/ });
    expect(pdfLink.getAttribute("href")).toBe(`/read/${MAT_PDF}?page=12&hl=1`);
    expect(pdfLink.textContent).toContain("12");
  });

  it("groups by Study Plan with task-context entries under their task, and each section folds", async () => {
    renderMistakesPage(hubHandlers(hubEntries));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    // plan group headers (the plan topics) + the task group header (the task's
    // node title); the kind chips mark each section's grouping kind
    expect(screen.getByRole("button", { name: "软工备考" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "英语口语" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "TCP 拥塞控制" })).toBeTruthy();
    expect(screen.getAllByText(zh("mistakes.kindPlan"))).toHaveLength(2);
    expect(screen.getByText(zh("mistakes.kindTask"))).toBeTruthy();

    // fold plan-1's section → its entry disappears from the DOM, the rest stay
    fireEvent.click(screen.getByRole("button", { name: "软工备考" }));
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
    expect(screen.getByText("需求可追溯性最直接的用途是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();
  });

  it("filters by plan or task through the dropdown", async () => {
    renderMistakesPage(hubHandlers(hubEntries));

    const picker = (await screen.findByRole("combobox", { name: zh("mistakes.filterLabel") })) as HTMLSelectElement;
    expect(picker).toBeTruthy();

    // pick plan-1 → only its entry
    fireEvent.change(picker, { target: { value: `plan:${PLAN_1}` } });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.queryByText("需求可追溯性最直接的用途是什么？")).toBeNull();
    expect(screen.queryByText("TCP 慢启动从一个多大的窗口开始？")).toBeNull();

    // pick the task → only its entry
    fireEvent.change(picker, { target: { value: `task:${TASK_1}` } });
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();

    // back to all
    fireEvent.change(picker, { target: { value: "" } });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();
  });

  it("re-quiz links launch the node-scoped plan flow; task-context entries launch the task's quiz route", async () => {
    renderMistakesPage(hubHandlers(hubEntries));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    const requizLinks = screen.getAllByRole("link", { name: new RegExp(zh("mistakes.requiz")) });
    expect(requizLinks).toHaveLength(3);
    const hrefs = requizLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/plan/${PLAN_1}/quiz?nodeId=${NODE_1}`);
    expect(hrefs).toContain(`/plan/${PLAN_2}/quiz?nodeId=${NODE_2}`);
    expect(hrefs).toContain(`/task/${TASK_1}/quiz`);
  });

  it("empty hub → the honest empty state (never a demo fallback)", async () => {
    renderMistakesPage(hubHandlers([]));

    expect(await screen.findByText(zh("mistakes.emptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("mistakes.emptyBody"))).toBeTruthy();
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();

    // demo residue absent: the RETIRED fixture copy (the fixture is gone —
    // the independent source) never renders again
    expect(screen.queryByText("3 道演示错题 · 复盘后重新出题")).toBeNull();
    expect(screen.queryByText("把「一起运行」当成了「验证协作」")).toBeNull();
    expect(screen.queryByText(/薄弱主题/)).toBeNull();
  });

  it("renders nothing while the hub read is loading (honest-empty, no flash of stale demo copy)", () => {
    const { container } = renderMistakesPage(hubHandlers(hubEntries));
    // the stub link resolves on the next tick — the first paint waits
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(zh("mistakes.emptyTitle"))).toBeNull();
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
  });
});

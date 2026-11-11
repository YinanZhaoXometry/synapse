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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

// Toasts are asserted directly (the real sonner Toaster is not mounted here);
// the resolve-toggle failure path pins the per-code toast at the hook.
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
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
  origin: "uploaded",
  generation: null,
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
  description: null,
  optional: false,
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
  resolved: false,
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

  it("the first paint of a loading page shows the shared PageLoader — never blank, never stale copy (epic-28 T3)", () => {
    const { container } = renderMistakesPage(hubHandlers(hubEntries));
    // the stub link resolves on the next tick — the first paint waits
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(zh("common.loading"))).toBeTruthy();
    expect(screen.queryByText(zh("mistakes.emptyTitle"))).toBeNull();
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
  });
});

// ── the resolve lifecycle (epic-18 T4, spec decision 4) ────────────────────

/** The lifecycle fixtures' LIVE copy: the SetMistakeEntryResolved handler
 * mutates these rows so the refetch read-back (MistakesHub re-served from
 * the same array) is observable in the DOM — the wire round-trip proven the
 * planner manual-task way. Fresh per test (the handler mutates the row
 * objects, never the shared factory output). */
function liveRows(): EchoFixture[] {
  return hubEntries.map((row) => ({ ...row }));
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The lifecycle handlers: MistakesHub serves the live rows verbatim; the
 * resolve mutation records its call (variables + a call counter) and flips
 * the row server-style. */
function lifecycleHandlers(rows: EchoFixture[], calls: EchoFixture[]) {
  return {
    ...hubHandlers(rows),
    SetMistakeEntryResolved: (variables: Record<string, unknown>) => {
      calls.push(variables);
      const input = variables.input as { id: string; resolved: boolean; clientUuid: string };
      const row = rows.find((r) => r.id === input.id);
      if (!row) throw new Error("not found: mistake entry");
      row.resolved = input.resolved;
      return { __typename: "SetMistakeEntryResolvedPayload", mistakeEntry: { __typename: "MistakeEntry", id: input.id, resolved: input.resolved } };
    },
  };
}

function cardFor(prompt: string): HTMLElement {
  const card = screen.getByText(prompt).closest("article");
  expect(card).toBeTruthy();
  return card as HTMLElement;
}

describe("MistakesPage — the resolve lifecycle (epic-18 T4, spec decision 4)", () => {
  it("toggles an entry resolved through the mutation; the hub read-back re-renders the quiet resolved state", async () => {
    const rows = liveRows();
    const calls: EchoFixture[] = [];
    renderMistakesPage(lifecycleHandlers(rows, calls));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    // no resolved chip before the toggle (scoped to the card — the state
    // picker's 「已复盘」 option shares the chip's text)
    const card0 = cardFor("集成测试的主要目的是什么？");
    expect(within(card0).queryByText(zh("mistakes.resolvedChip"))).toBeNull();

    fireEvent.click(within(card0).getByRole("button", { name: zh("mistakes.resolveDoneAria") }));

    // the chip + quiet state arrive ONLY through the refetch (no optimistic
    // write) — the wait is scoped to the CARD (the state picker's option
    // shares the chip's text from first paint)
    const card = await waitFor(() => {
      const c = cardFor("集成测试的主要目的是什么？");
      expect(within(c).getByText(zh("mistakes.resolvedChip"))).toBeTruthy();
      return c;
    });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy(); // readable, not removed
    expect(card.className).toContain("opacity-60"); // visually quiet
    expect(within(card).getByRole("button", { name: zh("mistakes.resolveReopenAria") }).getAttribute("aria-pressed")).toBe("true");

    // the mutation rode the wire with the entry's id + the TOGGLED state + a uuid-shaped client key
    expect(calls).toHaveLength(1);
    const input = calls[0].input as Record<string, unknown>;
    expect(input.id).toBe("me-1");
    expect(input.resolved).toBe(true);
    expect(UUID_SHAPE.test(String(input.clientUuid))).toBe(true);
  });

  it("reuses ONE stable client uuid per entry across toggles and retries (replay-safe)", async () => {
    const rows = liveRows();
    const calls: EchoFixture[] = [];
    renderMistakesPage(lifecycleHandlers(rows, calls));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    const button = () => within(cardFor("集成测试的主要目的是什么？")).getByRole("button", { name: zh("mistakes.resolveDoneAria") });

    fireEvent.click(button());
    await waitFor(() => expect(within(cardFor("集成测试的主要目的是什么？")).getByText(zh("mistakes.resolvedChip"))).toBeTruthy());
    fireEvent.click(within(cardFor("集成测试的主要目的是什么？")).getByRole("button", { name: zh("mistakes.resolveReopenAria") }));
    // back to open: the chip leaves through the refetch
    await waitFor(() => expect(within(cardFor("集成测试的主要目的是什么？")).queryByText(zh("mistakes.resolvedChip"))).toBeNull());
    fireEvent.click(button());
    await waitFor(() => expect(within(cardFor("集成测试的主要目的是什么？")).getByText(zh("mistakes.resolvedChip"))).toBeTruthy());

    // three toggles, ONE client uuid (minted once per entry, reused — the
    // server's replay answer is the state comparison, the key stays stable)
    expect(calls).toHaveLength(3);
    const uuids = calls.map((call) => (call.input as Record<string, unknown>).clientUuid);
    expect(new Set(uuids).size).toBe(1);
    // toggled BOTH ways: true → false → true
    expect(calls.map((call) => (call.input as Record<string, unknown>).resolved)).toEqual([true, false, true]);
  });

  it("resolves a forfeited entry identically (a forfeit is still a mistake worth reviewing)", async () => {
    const rows = liveRows();
    const calls: EchoFixture[] = [];
    renderMistakesPage(lifecycleHandlers(rows, calls));

    expect(await screen.findByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();

    fireEvent.click(within(cardFor("TCP 慢启动从一个多大的窗口开始？")).getByRole("button", { name: zh("mistakes.resolveDoneAria") }));

    await waitFor(() => expect(within(cardFor("TCP 慢启动从一个多大的窗口开始？")).getByText(zh("mistakes.resolvedChip"))).toBeTruthy());
    const input = calls[0].input as Record<string, unknown>;
    expect(input.id).toBe("me-3");
    expect(input.resolved).toBe(true);
  });

  it("filters by state through the second dropdown: open / resolved / all", async () => {
    const rows = liveRows();
    const calls: EchoFixture[] = [];
    renderMistakesPage(lifecycleHandlers(rows, calls));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    fireEvent.click(within(cardFor("集成测试的主要目的是什么？")).getByRole("button", { name: zh("mistakes.resolveDoneAria") }));
    await waitFor(() => expect(within(cardFor("集成测试的主要目的是什么？")).getByText(zh("mistakes.resolvedChip"))).toBeTruthy());

    const picker = screen.getByRole("combobox", { name: zh("mistakes.stateFilterLabel") }) as HTMLSelectElement;

    // resolved → only the toggled entry
    fireEvent.change(picker, { target: { value: "resolved" } });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.queryByText("需求可追溯性最直接的用途是什么？")).toBeNull();
    expect(screen.queryByText("TCP 慢启动从一个多大的窗口开始？")).toBeNull();

    // open → the other two
    fireEvent.change(picker, { target: { value: "open" } });
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
    expect(screen.getByText("需求可追溯性最直接的用途是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();

    // all → every entry back
    fireEvent.change(picker, { target: { value: "" } });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy();
    expect(screen.getByText("TCP 慢启动从一个多大的窗口开始？")).toBeTruthy();
  });

  it("a state filter that empties the list shows the honest quiet note (not a blank page)", async () => {
    renderMistakesPage(lifecycleHandlers(liveRows(), []));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: zh("mistakes.stateFilterLabel") }), { target: { value: "resolved" } });

    expect(screen.getByText(zh("mistakes.stateEmpty"))).toBeTruthy();
    expect(screen.queryByText("集成测试的主要目的是什么？")).toBeNull();
  });

  it("picker-driven emptiness falls to the regular empty card — the state note never speaks for the picker (epic-18 T6 review)", async () => {
    // The stale-picker scenario, driven the user-reachable way: the entry
    // under the SELECTED plan vanishes server-side between fetches (the
    // toggle's hub sweep re-reads a hub that no longer carries it), so the
    // picker holds a group the data no longer has — with the state filter
    // OFF. The regular empty treatment renders, never the state-filter note.
    const rows = liveRows();
    const purged = { done: false };
    const handlers = {
      ...hubHandlers(rows),
      MistakesHub: () => (purged.done ? rows.filter((row) => row.planId !== PLAN_1) : rows),
      SetMistakeEntryResolved: (variables: Record<string, unknown>) => {
        purged.done = true;
        const input = variables.input as { id: string; resolved: boolean };
        const row = rows.find((r) => r.id === input.id);
        if (!row) throw new Error("not found: mistake entry");
        row.resolved = input.resolved;
        return { __typename: "SetMistakeEntryResolvedPayload", mistakeEntry: { __typename: "MistakeEntry", id: input.id, resolved: input.resolved } };
      },
    };
    renderMistakesPage(handlers);

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();

    // pick plan-1 → only its entry
    const picker = screen.getByRole("combobox", { name: zh("mistakes.filterLabel") }) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: `plan:${PLAN_1}` } });
    expect(screen.getByText("集成测试的主要目的是什么？")).toBeTruthy();

    // the toggle's sweep re-reads a hub where plan-1's entry is gone
    fireEvent.click(within(cardFor("集成测试的主要目的是什么？")).getByRole("button", { name: zh("mistakes.resolveDoneAria") }));

    // entries > 0 (plan-2 + the task's), the picker is stale, the state
    // filter never moved — the regular empty card, NOT the state note
    await waitFor(() => expect(screen.getByText(zh("mistakes.emptyTitle"))).toBeTruthy());
    expect(screen.getByText(zh("mistakes.emptyBody"))).toBeTruthy();
    expect(screen.queryByText(zh("mistakes.stateEmpty"))).toBeNull();
  });

  // ── the toggle failure's per-code toast (epic-18 T6 review) ──────────────

  /** Handlers whose resolve mutation fails with the given closed-enum code
   * (the Apollo 4 wire shape thrown through the harness link — the
   * import-offer validation-failure precedent). */
  function failingResolveHandlers(code: string) {
    const rows = liveRows();
    return {
      ...hubHandlers(rows),
      SetMistakeEntryResolved: () => {
        throw new CombinedGraphQLErrors({
          errors: [{ message: `resolve failed: ${code}`, extensions: { code } }],
        });
      },
    };
  }

  function toggleFirstCard() {
    fireEvent.click(within(cardFor("集成测试的主要目的是什么？")).getByRole("button", { name: zh("mistakes.resolveDoneAria") }));
  }

  it("a NOT_FOUND toggle failure toasts its honest per-code key, never the generic persist-failed line", async () => {
    vi.mocked(toast.error).mockClear();
    renderMistakesPage(failingResolveHandlers("NOT_FOUND"));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    toggleFirstCard();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("mistakes.resolveNotFound")));
    expect(toast.error).not.toHaveBeenCalledWith(zh("errors.persistFailed"));
  });

  it("a VALIDATION_FAILED toggle failure stays on the generic persist-failed toast", async () => {
    vi.mocked(toast.error).mockClear();
    renderMistakesPage(failingResolveHandlers("VALIDATION_FAILED"));

    expect(await screen.findByText("集成测试的主要目的是什么？")).toBeTruthy();
    toggleFirstCard();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("errors.persistFailed")));
    expect(toast.error).not.toHaveBeenCalledWith(zh("mistakes.resolveNotFound"));
  });
});

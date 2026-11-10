import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  DeletePlanDocument,
  MaterialsDocument,
  PlanDocument,
  PlansDocument,
  ReadingProgressListDocument,
  SquarePlansDocument,
  TasksDocument,
} from "@/types/graphql";
import PlansHomePage from "./PlansHomePage";

/**
 * PlansHomePage observable states (T3; FR-37; AD-8/9; spec testing seam 4 —
 * component render seam): the pitch + create-task entry in the empty state,
 * the create-task entry persisting next to create-new when plans exist, the
 * Study Tasks section rendering only when ≥ 1 task exists (no empty chrome),
 * rows carrying title + single-node ring + working task-home and
 * continue-reading links. Data rides the Apollo cutover's seams (epic P2-8):
 * server-shaped query mocks feed the page, and expected copy reads the
 * dictionary directly (independent source, never recomputed); stub routes
 * capture navigation instead of mounting pages. Mastery numbers are SERVER
 * fields (AD-14) — the fixtures carry them and the rows render them verbatim.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhN = (key: string, n: number | string) => zh(key).replace("{n}", String(n));

function PlanNewLanding() {
  return <p data-testid="plan-new-landing" />;
}
function TaskNewLanding() {
  return <p data-testid="task-new-landing" />;
}
function ReaderLanding() {
  return <p data-testid="reader-landing" />;
}

// -- server-shaped fixtures (the generated types' exact selections) ------------

const NOW = "2026-11-01T00:00:00Z";

const nodeFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "KnowledgeNode",
  id: "n-1",
  planId: "plan-1",
  taskId: null,
  stage: null,
  title: "node-1",
  description: null,
  optional: false,
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  createdAt: NOW,
  ...overrides,
});

const materialFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Material",
  id: "m-1",
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 2048,
  planId: null,
  taskId: "t-1",
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: NOW,
  downloadUrl: "https://storage.example/m-1",
  sections: [{ __typename: "MaterialSection", id: "intro", title: "Intro", text: "intro text" }],
  ...overrides,
});

const planRowFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "StudyPlan",
  id: "plan-1",
  topic: "软件工程备考",
  goal: null,
  createdAt: NOW,
  masteryScore: "12",
  forkedFromTopic: null,
  ...overrides,
});

const planDetailFixture = () => ({
  __typename: "StudyPlan",
  ...planRowFixture(),
  visibility: "private",
  edges: [],
  nodes: [nodeFixture()],
  materials: [{ ...materialFixture({ taskId: null, sections: [] }) }],
});

const taskFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "StudyTask",
  id: "t-1",
  materialId: "m-1",
  nodeId: "n-1",
  createdAt: NOW,
  node: nodeFixture(),
  ...overrides,
});

const progressFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "ReadingProgress",
  id: "rp-1",
  materialId: "m-1",
  updatedAt: NOW,
  position: {
    __typename: "ReadingPosition",
    text: "page three text",
    locator: { __typename: "ReadingLocator", kind: "pdf", page: 3, sectionId: null },
  },
  ...overrides,
});

/** Generous usage counts — several watchers mount over the same documents. */
const USAGE = 8;

/** The mock set for one scenario; every list the page reads has an entry. */
function mocksFor(scenario: {
  plans?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  progress?: Array<Record<string, unknown>>;
  planDetail?: Record<string, unknown> | null;
  allMaterials?: Array<Record<string, unknown>>;
  taskMaterials?: Array<Record<string, unknown>>;
}) {
  const {
    plans = [],
    tasks = [],
    progress = [],
    planDetail = null,
    allMaterials = [],
    taskMaterials = [],
  } = scenario;
  const mocks: Array<Record<string, unknown>> = [
    { request: { query: PlansDocument, variables: {} }, result: { data: { plans } }, maxUsageCount: USAGE },
    { request: { query: TasksDocument, variables: {} }, result: { data: { tasks } }, maxUsageCount: USAGE },
    {
      request: { query: ReadingProgressListDocument, variables: {} },
      result: { data: { readingProgressList: progress } },
      maxUsageCount: USAGE,
    },
  ];
  if (planDetail !== null) {
    mocks.push({
      request: { query: PlanDocument, variables: { id: "plan-1" } },
      result: { data: { plan: planDetail } },
      maxUsageCount: USAGE,
    });
  }
  mocks.push({
    request: { query: MaterialsDocument, variables: {} },
    result: { data: { materials: allMaterials } },
    maxUsageCount: USAGE,
  });
  // one mock per seeded task — the row's material rides Materials({ taskId: task.id })
  for (const task of tasks) {
    mocks.push({
      request: { query: MaterialsDocument, variables: { taskId: (task as { id?: string }).id } },
      result: { data: { materials: taskMaterials } },
      maxUsageCount: USAGE,
    });
  }
  return mocks;
}

function renderPlansHome(mocks: Array<Record<string, unknown>>) {
  return render(
    <LanguageProvider>
      <Toaster />
      <MockedProvider mocks={mocks as never}>
        <MemoryRouter initialEntries={["/plans"]}>
          <Routes>
            <Route path="/plans" element={<PlansHomePage />} />
            <Route path="/plan/new" element={<PlanNewLanding />} />
            <Route path="/task/new" element={<TaskNewLanding />} />
            <Route path="/read/:materialId" element={<ReaderLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

const entryButton = () => screen.getByRole("button", { name: new RegExp(zh("tasks.createEntry")) });
const sectionHeading = () => screen.queryByRole("heading", { name: zh("tasks.eyebrow") });

describe("PlansHomePage — create-task entries (FR-37; AD-8; UJ-6)", () => {
  it("empty state: the pitch and the create-task entry sit alongside the creation chat, no create-new", async () => {
    renderPlansHome(mocksFor({}));

    // the pitch copy (UX spine microcopy, verbatim key) + the entry beside the chat
    expect(await screen.findByText(zh("tasks.pitch"))).toBeInTheDocument();
    expect(entryButton()).toBeInTheDocument();
    // the creation chat is still the primary surface (existing behavior)
    expect(screen.getByPlaceholderText(zh("plans.messagePlaceholder"))).toBeInTheDocument();
    // empty state keeps hiding create-new (existing behavior unchanged)
    expect(screen.queryByRole("button", { name: new RegExp(zh("plans.createNew")) })).not.toBeInTheDocument();
    // zero tasks → no section chrome
    expect(sectionHeading()).not.toBeInTheDocument();
  });

  it("empty-state create-task entry navigates to the creation route /task/new", async () => {
    renderPlansHome(mocksFor({}));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(zh("tasks.createEntry")) }));
    expect(await screen.findByTestId("task-new-landing")).toBeInTheDocument();
  });

  it("plans-exist state: the create-task entry persists next to create-new; zero tasks → no section", async () => {
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }));

    expect(await screen.findByRole("button", { name: new RegExp(zh("plans.createNew")) })).toBeInTheDocument();
    expect(entryButton()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: zh("plans.returningTitle") })).toBeInTheDocument();
    expect(sectionHeading()).not.toBeInTheDocument();
  });

  it("plans-exist create-new still navigates to /plan/new (existing behavior unchanged)", async () => {
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(zh("plans.createNew")) }));
    expect(await screen.findByTestId("plan-new-landing")).toBeInTheDocument();
  });
});

describe("PlansHomePage — Study Tasks section (FR-37; FR-10; UJ-6)", () => {
  it("with ≥ 1 task: rows of title + single-node ring, a task-home link (no dead link), and a continue-reading link", async () => {
    const material = materialFixture();
    renderPlansHome(
      mocksFor({
        plans: [planRowFixture()],
        planDetail: planDetailFixture(),
        tasks: [taskFixture()],
        allMaterials: [],
        taskMaterials: [material],
      }),
    );

    // the section appears with its heading
    expect(await screen.findByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    // the row carries the material's title and links to the task home route
    const taskLink = await screen.findByRole("link", { name: new RegExp("复习讲义") });
    expect(taskLink).toHaveAttribute("href", "/task/t-1");
    // the row's single-node mastery ring reads the server's honest uncovered 0 (AD-6, no evidence; AD-14)
    expect(within(taskLink).getByRole("img", { name: zhN("plans.masteryAria", 0) })).toBeInTheDocument();
    // no stored position → the plain reader link, labelled 打开 (not 继续)
    const openLink = await screen.findByRole("link", { name: new RegExp(zh("common.open")) });
    expect(openLink).toHaveAttribute("href", "/read/m-1");
  });

  it("the continue-reading link deep-links into the reader at the stored position (?page=N)", async () => {
    const material = materialFixture({
      id: "m-paper",
      taskId: "t-paper",
      title: "paper",
      kind: "pdf",
      sections: [
        { __typename: "MaterialSection", id: "page-1", title: "p1", text: "a" },
        { __typename: "MaterialSection", id: "page-3", title: "p3", text: "b" },
      ],
    });
    renderPlansHome(
      mocksFor({
        plans: [planRowFixture()],
        planDetail: planDetailFixture(),
        tasks: [taskFixture({ id: "t-paper", materialId: "m-paper", title: "paper" })],
        progress: [progressFixture({ materialId: "m-paper" })],
        allMaterials: [material],
        taskMaterials: [material],
      }),
    );

    expect(await screen.findByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: new RegExp("paper") })).toHaveAttribute("href", "/task/t-paper");
    const continueLink = await screen.findByRole("link", { name: new RegExp(zh("plans.continueReading")) });
    expect(continueLink).toHaveAttribute("href", "/read/m-paper?page=3");
  });

  it("tasks render even with zero plans — the empty state carries the section too", async () => {
    const material = materialFixture({ title: "solo-notes", taskId: "t-solo" });
    renderPlansHome(
      mocksFor({
        tasks: [taskFixture({ id: "t-solo", title: "solo-notes" })],
        allMaterials: [],
        taskMaterials: [material],
      }),
    );

    // still the empty state (pitch + chat), plus the task section
    expect(await screen.findByText(zh("tasks.pitch"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(zh("plans.messagePlaceholder"))).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: new RegExp("solo-notes") })).toHaveAttribute("href", "/task/t-solo");
  });
});

// -- epic P2-11 T3: the 广场 tab + fork attribution ------------------------------

const NOW_T3 = "2026-11-05T00:00:00Z";

const squarePlanFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "SquarePlan",
  id: "sq-1",
  topic: "雅思口语 6.5",
  goal: "六周冲刺",
  visibility: "public",
  createdAt: NOW_T3,
  nodeSummaries: [
    { __typename: "SquareNodeSummary", title: "基础·语音", stage: "基础", order: 0 },
    { __typename: "SquareNodeSummary", title: "应用·模考", stage: "应用", order: 1 },
  ],
  ...overrides,
});

describe("PlansHomePage — the 广场 tab (FR-39 web half; delta decision 3)", () => {
  function squareMock(plans: Array<Record<string, unknown>>) {
    return { request: { query: SquarePlansDocument, variables: {} }, result: { data: { squarePlans: plans } }, maxUsageCount: 6 };
  }

  it("renders the 我的计划 / 广场 pill pair with 我的计划 pressed by default", async () => {
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }));

    const toggle = await screen.findByTestId("plans-home-tabs");
    expect(within(toggle).getByRole("button", { name: zh("square.tabMine") })).toHaveAttribute("aria-pressed", "true");
    expect(within(toggle).getByRole("button", { name: zh("square.tabSquare") })).toHaveAttribute("aria-pressed", "false");
    // default body is the mine tab (no Square section mounted — no demo data)
    expect(screen.queryByTestId("square-section")).not.toBeInTheDocument();
  });

  it("clicking 广场 swaps the body to the Square cards (mine content unmounts — real data only)", async () => {
    renderPlansHome([
      ...mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }),
      squareMock([squarePlanFixture()]),
    ]);

    fireEvent.click(await screen.findByRole("button", { name: zh("square.tabSquare") }));

    const section = await screen.findByTestId("square-section");
    expect(within(section).getByTestId("square-plan-card")).toBeInTheDocument();
    expect(within(section).getByText("雅思口语 6.5")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: new RegExp(zh("square.adopt")) })).toBeInTheDocument();
    // the mine body is gone (the plan card unmounts; the header + actions persist by design)
    expect(screen.queryByText("软件工程备考")).not.toBeInTheDocument();
    // aria-pressed flips
    const toggle = screen.getByTestId("plans-home-tabs");
    expect(within(toggle).getByRole("button", { name: zh("square.tabSquare") })).toHaveAttribute("aria-pressed", "true");
  });

  it("the Square tab stays reachable from the empty state (a fresh user can browse public plans)", async () => {
    renderPlansHome([...mocksFor({}), squareMock([])]);

    fireEvent.click(await screen.findByRole("button", { name: zh("square.tabSquare") }));

    expect(await screen.findByTestId("square-section")).toBeInTheDocument();
    expect(screen.getByText(zh("square.empty"))).toBeInTheDocument();
    expect(screen.queryByTestId("square-plan-card")).not.toBeInTheDocument();
  });
});

describe("PlansHomePage — fork attribution on plan rows (OQ-12, epic P2-11 T3)", () => {
  it("a forked plan's card shows the fork glyph + the source topic snapshot", async () => {
    const forked = planRowFixture({ forkedFromTopic: "雅思口语 6.5" });
    renderPlansHome(mocksFor({ plans: [forked], planDetail: planDetailFixture(), allMaterials: [] }));

    const card = await screen.findByTestId("plan-card-fork");
    expect(card).toHaveTextContent("雅思口语 6.5");
  });

  it("a plan that is not a fork shows no attribution row", async () => {
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }));

    expect(await screen.findByRole("button", { name: new RegExp(zh("plans.createNew")) })).toBeInTheDocument();
    expect(screen.queryByTestId("plan-card-fork")).not.toBeInTheDocument();
  });
});

describe("PlansHomePage — plan deletion (epic-28 T4)", () => {
  const deleteMock = {
    request: { query: DeletePlanDocument, variables: { input: { id: "plan-1" } } },
    result: { data: { deletePlan: { __typename: "DeletePlanPayload", deletedPlanId: "plan-1" } } },
    // the gating contract: exactly ONE wire call — a double-fire (the icon
    // click AND the confirm both mutating) would fail this mock
    maxUsageCount: 1,
  };

  it("the destructive affordance opens the strong confirm; cancel deletes nothing", async () => {
    const user = userEvent.setup();
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }).concat(deleteMock));

    // the whole-card button still navigates; the trash is its SIBLING
    fireEvent.click(await screen.findByTestId("plan-delete-button"));
    expect(await screen.findByText(zh("plans.deleteTitle"))).toBeInTheDocument();

    await user.click(screen.getByTestId("plan-delete-cancel"));
    await waitFor(() => expect(screen.queryByText(zh("plans.deleteTitle"))).not.toBeInTheDocument());
    // the card survives, and the ONE wire call is still unspent: a second
    // round-trip through the dialog ends in the success toast — cancel was a
    // true no-op, not a consumed mutation.
    fireEvent.click(screen.getByTestId("plan-delete-button"));
    await user.click(await screen.findByTestId("plan-delete-confirm"));
    expect(await screen.findByText(zh("plans.deleteSuccess"))).toBeInTheDocument();
  });

  it("confirm fires the mutation exactly once and toasts the success", async () => {
    const user = userEvent.setup();
    renderPlansHome(mocksFor({ plans: [planRowFixture()], planDetail: planDetailFixture(), allMaterials: [] }).concat(deleteMock));

    fireEvent.click(await screen.findByTestId("plan-delete-button"));
    await user.click(await screen.findByTestId("plan-delete-confirm"));

    // the key-path voice (epic-28 T2's convention rides the deletion too)
    expect(await screen.findByText(zh("plans.deleteSuccess"))).toBeInTheDocument();
  });
});

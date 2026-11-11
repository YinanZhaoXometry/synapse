import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MaterialsDocument, PlansDocument, TasksDocument } from "@/types/graphql";
import { CommandPalette } from "./CommandPalette";

/**
 * The ⌘K palette's entity search (epic-33 T2): empty query opens with the
 * recent-plans shelf (top 5); typing filters plans/materials/tasks manually
 * (deterministic includes, capped at 8 per group with a count hint); rows
 * deep-link to /plan/:id, /read/:materialId, /task/:id. Filtering is manual
 * (shouldFilter=false), so matching is plain substring — no fuzzy scorer.
 */

const wirePlan = (overrides: Record<string, unknown> = {}) => ({
  __typename: "StudyPlan",
  id: "plan-1",
  topic: "分布一致性协议",
  goal: null,
  createdAt: "2026-11-01T00:00:00Z",
  masteryScore: "42",
  visibility: "private",
  forkedFromTopic: null,
  ...overrides,
});

const wireMaterial = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Material",
  id: "mat-1",
  title: "共识协议讲义",
  kind: "markdown",
  sizeBytes: 1024,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: "2026-11-02T00:00:00Z",
  downloadUrl: null,
  sections: [],
  ...overrides,
});

const wireNode = (overrides: Record<string, unknown> = {}) => ({
  __typename: "KnowledgeNode",
  id: "node-1",
  planId: null,
  taskId: "task-1",
  stage: null,
  title: "Paxos 推导",
  description: null,
  optional: false,
  order: 0,
  masteryScore: "10",
  state: "uncovered",
  createdAt: "2026-11-03T00:00:00Z",
  ...overrides,
});

const wireTask = (overrides: Record<string, unknown> = {}) => ({
  __typename: "StudyTask",
  id: "task-1",
  materialId: "mat-1",
  nodeId: "node-1",
  createdAt: "2026-11-03T00:00:00Z",
  promotedPlanId: null,
  promotedAt: null,
  promotedPlan: null,
  node: wireNode(),
  ...overrides,
});

const plansMock = (plans: Record<string, unknown>[]): MockedResponse => ({
  request: { query: PlansDocument, variables: {} },
  result: { data: { __typename: "Query", plans } },
});

const materialsMock = (materials: Record<string, unknown>[]): MockedResponse => ({
  request: { query: MaterialsDocument, variables: {} },
  result: { data: { __typename: "Query", materials } },
});

const tasksMock = (tasks: Record<string, unknown>[]): MockedResponse => ({
  request: { query: TasksDocument, variables: {} },
  result: { data: { __typename: "Query", tasks } },
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

const baseMocks = (extra: MockedResponse[] = []): MockedResponse[] => [
  plansMock([wirePlan()]),
  materialsMock([wireMaterial()]),
  tasksMock([wireTask()]),
  ...extra,
];

function renderPalette(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <LanguageProvider>
          <CommandPalette open onOpenChange={() => {}} />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    </MockedProvider>
  );
}

describe("CommandPalette entity search", () => {
  it("empty query shows page nav, the recent-plans shelf (top 5) and the language toggle", async () => {
    const six = Array.from({ length: 6 }, (_, index) =>
      wirePlan({ id: `plan-${index}`, topic: `计划 ${index}`, createdAt: `2026-11-0${index + 1}T00:00:00Z` })
    );
    renderPalette([plansMock(six), materialsMock([]), tasksMock([])]);
    // Recent shelf capped at 5 (topics are "计划 0".."计划 5"; the nav item's
    // 学习计划 never matches the anchored digit pattern).
    const rows = await screen.findAllByText(/^计划 \d$/);
    expect(rows).toHaveLength(5);
    expect(screen.getByText("最近计划")).toBeInTheDocument();
    // Page nav + language toggle still present.
    expect(screen.getByText("学习计划")).toBeInTheDocument();
    expect(screen.getByText("切换到 English")).toBeInTheDocument();
    // Newest-first keeps 计划 5 (2026-11-06) and drops the oldest (计划 0).
    expect(screen.queryByText("计划 0")).not.toBeInTheDocument();
  });

  it("typing filters entities; a plan row deep-links to the plan", async () => {
    const user = userEvent.setup();
    renderPalette(baseMocks());
    const input = await screen.findByRole("combobox");
    await user.type(input, "分布");
    const row = await screen.findByRole("option", { name: /分布一致性协议/ });
    await user.click(row);
    expect(screen.getByTestId("location")).toHaveTextContent("/plan/plan-1");
    // Non-matching groups stay hidden.
    expect(screen.queryByRole("option", { name: /共识协议讲义/ })).not.toBeInTheDocument();
  });

  it("a material match deep-links to the reader", async () => {
    const user = userEvent.setup();
    renderPalette(baseMocks());
    const input = await screen.findByRole("combobox");
    await user.type(input, "讲义");
    await user.click(await screen.findByRole("option", { name: /共识协议讲义/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/read/mat-1");
  });

  it("a task match deep-links to the task home (label = the owned node's title)", async () => {
    const user = userEvent.setup();
    renderPalette(baseMocks());
    const input = await screen.findByRole("combobox");
    await user.type(input, "Paxos");
    await user.click(await screen.findByRole("option", { name: /Paxos 推导/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/task/task-1");
  });

  it("matches beyond the per-group cap render a count hint and stay capped", async () => {
    const user = userEvent.setup();
    const ten = Array.from({ length: 10 }, (_, index) =>
      wirePlan({ id: `plan-${index}`, topic: `复习 ${index}`, createdAt: `2026-11-0${(index % 9) + 1}T00:00:00Z` })
    );
    renderPalette([plansMock(ten), materialsMock([]), tasksMock([])]);
    const input = await screen.findByRole("combobox");
    await user.type(input, "复习");
    expect(await screen.findByText("学习计划（10）")).toBeInTheDocument();
    const rows = screen.getAllByRole("option").filter(row => row.textContent?.includes("复习"));
    expect(rows).toHaveLength(8);
  });

  it("no entity match anywhere falls through to cmdk's empty state", async () => {
    const user = userEvent.setup();
    renderPalette(baseMocks());
    const input = await screen.findByRole("combobox");
    await user.type(input, "不存在的词");
    await waitFor(() => {
      expect(screen.getByText("没有匹配的结果")).toBeInTheDocument();
    });
  });

  it("keyboard: typing then Enter selects the first match", async () => {
    const user = userEvent.setup();
    renderPalette(baseMocks());
    const input = await screen.findByRole("combobox");
    await user.type(input, "分布");
    // Sync point: the match is on screen (React committed, cmdk's selection
    // recomputed) before the keypress — Enter selects the first visible item.
    await screen.findByRole("option", { name: /分布一致性协议/ });
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/plan/plan-1");
    });
  });

  it("T03: ⌘K is intercepted at capture phase — preventDefault + toggle; keyup never toggles", () => {
    const onOpenChange = vi.fn();
    render(
      <MockedProvider mocks={baseMocks()}>
        <MemoryRouter>
          <LanguageProvider>
            <CommandPalette open={false} onOpenChange={onOpenChange} />
          </LanguageProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    // The keydown is consumed before it can reach any browser default or
    // another page handler.
    const down = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    window.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // The release is swallowed too — and never toggles the palette twice.
    onOpenChange.mockClear();
    const up = new KeyboardEvent("keyup", { key: "k", metaKey: true, cancelable: true });
    window.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    // Plain k (no modifier) is untouched.
    const plain = new KeyboardEvent("keydown", { key: "k", cancelable: true });
    window.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

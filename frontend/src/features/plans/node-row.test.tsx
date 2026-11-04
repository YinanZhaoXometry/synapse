import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { usePlanNodeMappingsQuery, usePlanNodesQuery, usePlanQuery, useRecordEvidenceMutation } from "@/api";
import { PlanDocument, PlanNodeMappingsDocument, RecordEvidenceDocument } from "@/types/graphql";
import type { KnowledgeNodeView, MaterialView } from "@/api/views";
import { nodeRowViews } from "./display-shaping";
import NodeRow from "./node-row";

/**
 * The PlanHome node row (epic P2-10 T3, FR-6/7): state via the SHARED contract
 * badge (AD-9, never color-only), the click-through over the REAL anchor
 * channel (AD-8) with a jump menu for multiple confirmed mappings, the node
 * Quick Test fallback into the plan flow, and the LIVE state update — an
 * evidence mutation's payload carries the fresh node, the cache normalizes it,
 * and the row flips WITHOUT any plan-level refetch (pinned by the absence of
 * a second PlanDocument mock: a refetch would error against MockedProvider).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const wireNode = (overrides: Record<string, unknown> = {}) => ({
  __typename: "KnowledgeNode",
  id: "n-1",
  planId: "plan-1",
  taskId: null,
  stage: null,
  title: "Consensus",
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const wirePlan = (nodes: Record<string, unknown>[]) => ({
  __typename: "Query",
  plan: {
    __typename: "StudyPlan",
    id: "plan-1",
    topic: "Distributed systems",
    goal: null,
    createdAt: "2026-11-05T00:00:00Z",
    masteryScore: "0",
    visibility: "private",
    nodes,
    materials: [],
  },
});

const planMock = (nodeOverrides: Record<string, unknown> = {}): MockedResponse => ({
  request: { query: PlanDocument, variables: { id: "plan-1" } },
  result: { data: wirePlan([wireNode(nodeOverrides)]) },
});

const wireMapping = (overrides: Record<string, unknown> = {}) => ({
  __typename: "MaterialNodeMapping",
  id: "row-1",
  materialId: "m-md",
  nodeId: "n-1",
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "confirmed",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const mappingsMock = (rows: Record<string, unknown>[]): MockedResponse => ({
  request: { query: PlanNodeMappingsDocument, variables: { planId: "plan-1" } },
  result: { data: { __typename: "Query", planNodeMappings: rows } },
});

const failedMappingsMock: MockedResponse = {
  request: { query: PlanNodeMappingsDocument, variables: { planId: "plan-1" } },
  error: new Error("mapping read failed"),
};

const MATERIALS: MaterialView[] = [
  {
    id: "m-md",
    title: "Distributed systems notes",
    kind: "markdown",
    sizeBytes: 1,
    planId: "plan-1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    parseFailureReason: undefined,
    sections: [
      { id: "sec-1", title: "Raft", text: "leader election" },
      { id: "sec-2", title: "Chains", text: "chain replication" },
    ],
    createdAt: "2026-11-05T00:00:00Z",
    downloadUrl: null,
  },
];

/**
 * The real row composition: rows ride the plan-nodes read like PlanHome's do,
 * the mapping rows ride the PLAN-SCOPE batch read (T4's binding — the per-node
 * read was an eager N+1), and the record button fires the evidence mutation
 * exactly as the quiz driver does (the live-update test's only affordance).
 */
function RowHarness() {
  const views = nodeRowViews(usePlanNodesQuery("plan-1").data ?? [], []);
  const rollup = usePlanQuery("plan-1").data?.plan.masteryScore;
  const mappings = usePlanNodeMappingsQuery("plan-1");
  const [recordEvidence] = useRecordEvidenceMutation();
  return (
    <>
      <button type="button" onClick={() => void recordEvidence({ variables: { input: { sessionId: "s-1", results: [] } } })}>
        record
      </button>
      <span data-testid="plan-rollup">{rollup}</span>
      {views.map((view) => (
        <NodeRow
          key={view.node.id}
          view={view}
          planId="plan-1"
          materials={MATERIALS}
          mappings={mappings.data}
          mappingsFailed={!!mappings.error}
        />
      ))}
    </>
  );
}

function mount(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <LanguageProvider>
          <RowHarness />
        </LanguageProvider>
      </MemoryRouter>
    </MockedProvider>,
  );
}

const emptyMappings = mappingsMock([]);

describe("NodeRow regression (the shared state contract)", () => {
  it("renders the server state as badge (glyph + label, distinct aria) with the em-dash score when no evidence", async () => {
    mount([planMock(), emptyMappings]);

    const badge = await screen.findByTestId("node-state-badge");
    expect(badge).toHaveAttribute("data-state", "uncovered");
    expect(badge).toHaveTextContent(zhDict["plans.stateUncovered"]);
    expect(badge.getAttribute("aria-label")).toContain(zhDict["plans.stateUncovered"]);
    expect(screen.getByText("Consensus")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    // Evidence popover still present (regression).
    expect(screen.getByRole("button", { name: zhDict["plans.viewEvidenceAria"] })).toBeInTheDocument();
  });
});

describe("NodeRow click-through (FR-7)", () => {
  it("no confirmed mapping → the node Quick Test into the plan flow with the nodeId param", async () => {
    mount([planMock(), emptyMappings]);

    const quickTest = await screen.findByTestId("node-quick-test");
    expect(quickTest).toHaveAttribute("href", "/plan/plan-1/quiz?nodeId=n-1");
    expect(quickTest.getAttribute("aria-label")).toBe(zhDict["plans.nodeQuickTestAria"].replace("{node}", "Consensus"));
    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
  });

  it("one confirmed mapping → the study action through the REAL anchor channel", async () => {
    mount([planMock(), mappingsMock([wireMapping()])]);

    const study = await screen.findByTestId("node-study-action");
    expect(study).toHaveAttribute("href", "/read/m-md?hl=1#sec-1");
    expect(study.getAttribute("aria-label")).toBe(zhDict["plans.nodeStudyAria"].replace("{node}", "Consensus"));
    // The Quick Test stays reachable beside the study action.
    expect(screen.getByTestId("node-quick-test")).toBeInTheDocument();
    // No jump menu for a single target.
    expect(screen.queryByTestId("node-jump-trigger")).not.toBeInTheDocument();
  });

  it("multiple confirmed mappings → a jump menu listing mapped sections BY TITLE", async () => {
    mount([planMock(), mappingsMock([wireMapping(), wireMapping({ id: "row-2", sectionId: "sec-2" })])]);

    fireEvent.click(await screen.findByTestId("node-jump-trigger"));

    const items = await screen.findAllByTestId("node-jump-item");
    expect(items.map((item) => item.textContent)).toEqual(["Raft", "Chains"]);
    expect(items[0]).toHaveAttribute("href", "/read/m-md?hl=1#sec-1");
    expect(items[1]).toHaveAttribute("href", "/read/m-md?hl=1#sec-2");
  });

  it("only non-confirmed rows → the Quick Test fallback", async () => {
    mount([planMock(), mappingsMock([wireMapping({ status: "proposed" })])]);

    await waitFor(() => expect(screen.getByTestId("node-quick-test")).toBeInTheDocument());
    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("node-jump-trigger")).not.toBeInTheDocument();
  });

  it("the mappings read FAILS → the always-valid Quick Test still renders (no study action)", async () => {
    // The spec floor the module docstring promises: a failed mapping read must
    // not strip the row of EVERY action — the Quick Test is always valid.
    mount([planMock(), failedMappingsMock]);

    const quickTest = await screen.findByTestId("node-quick-test");
    expect(quickTest).toHaveAttribute("href", "/plan/plan-1/quiz?nodeId=n-1");
    expect(screen.queryByTestId("node-study-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("node-jump-trigger")).not.toBeInTheDocument();
  });
});

describe("NodeRow live update (the AC: no whole-plan refetch)", () => {
  it("an evidence mutation's payload moves the row's state AND the plan rollup via the cache — with NO plan refetch", async () => {
    // Deliberately NO second PlanDocument mock: if the mechanism still swept
    // the whole plan, this query would re-fire and error against the provider.
    mount([
      planMock(),
      emptyMappings,
      {
        request: { query: RecordEvidenceDocument, variables: { input: { sessionId: "s-1", results: [] } } },
        result: {
          data: {
            recordEvidence: {
              __typename: "RecordEvidencePayload",
              session: {
                __typename: "QuizSession",
                id: "s-1",
                planId: "plan-1",
                taskId: null,
                mode: "open",
                status: "completed",
                createdAt: "2026-11-05T00:00:00Z",
                completedAt: "2026-11-05T00:05:00Z",
                questions: [],
              },
              evidence: [],
              mistakes: [],
              nodes: [wireNode({ masteryScore: "99", state: "partial" })],
              plan: { __typename: "StudyPlan", id: "plan-1", masteryScore: "99" },
            },
          },
        },
      },
    ]);

    await screen.findByTestId("node-state-badge");
    expect(screen.getByTestId("node-state-badge")).toHaveAttribute("data-state", "uncovered");

    fireEvent.click(screen.getByText("record"));

    // The row flips from the payload-carried node, normalized into the cache —
    // and the plan's rollup rides the payload's plan half the same way.
    await waitFor(() => expect(screen.getByTestId("node-state-badge")).toHaveAttribute("data-state", "partial"));
    expect(screen.getByTestId("node-state-badge")).toHaveTextContent(zhDict["plans.statePartial"]);
    expect(screen.getByTestId("plan-rollup")).toHaveTextContent("99");
  });
});

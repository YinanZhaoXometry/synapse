import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { usePlanNodesQuery } from "@/api";
import {
  ConfirmMappingProposalsDocument,
  MaterialNodeMappingsDocument,
  PlanDocument,
  RejectMappingProposalsDocument,
} from "@/types/graphql";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView } from "@/api/views";
import MaterialCoveragePanel from "./MaterialCoveragePanel";
import { coverageGroups } from "./coverage-grouping";

/**
 * MaterialCoveragePanel (epic P2-10 T1; FR-45; delta decision 3 — component
 * render seam, PlansHomePage.test.tsx precedent): the four collapsible
 * groups render from fixture views with every row in exactly ONE group
 * (nothing silently dropped), bulk confirm/reject ride the mapping
 * mutations with the group's row ids, the confirm sweep reaches the PLAN
 * read so a confirmed group's new node renders by title (never a raw uuid),
 * a failed coverage read renders a distinct failure state (never the
 * affirmative empty state), and the mapping namespace exists in BOTH
 * dictionary languages (independent source, never recomputed).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const row = (overrides: Partial<MaterialNodeMappingView> & { id: string; sectionId: string }): MaterialNodeMappingView => ({
  materialId: "m-1",
  nodeId: null,
  proposedNodeTitle: null,
  status: "proposed",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const ROWS: MaterialNodeMappingView[] = [
  row({ id: "r-1", sectionId: "sec-1", status: "confirmed", nodeId: "n-1" }),
  row({ id: "r-2", sectionId: "sec-2", proposedNodeTitle: "Failure detection" }),
  row({ id: "r-3", sectionId: "sec-3", proposedNodeTitle: "Failure detection" }),
  row({ id: "r-4", sectionId: "sec-4", nodeId: "n-1" }),
  row({ id: "r-5", sectionId: "sec-5", status: "rejected", proposedNodeTitle: "Old idea" }),
  row({ id: "r-6", sectionId: "sec-6" }),
];

const MATERIAL: MaterialView = {
  id: "m-1",
  title: "Distributed systems notes",
  kind: "markdown",
  sizeBytes: 1234,
  planId: "plan-1",
  taskId: null,
  parseState: "parsed",
  parseFailureReason: undefined,
  sections: [
    { id: "sec-1", title: "Raft", text: "" },
    { id: "sec-2", title: "Chains", text: "" },
    { id: "sec-3", title: "Gossip", text: "" },
    { id: "sec-4", title: "Swim", text: "" },
    { id: "sec-5", title: "Old", text: "" },
    { id: "sec-6", title: "Recipes", text: "" },
  ],
  createdAt: "2026-11-05T00:00:00Z",
  downloadUrl: null,
};

const NODES: KnowledgeNodeView[] = [
  { id: "n-1", planId: "plan-1", taskId: null, stage: null, title: "Consensus", order: 0, masteryScore: "0", state: "uncovered" },
];

/** Wire-shaped fixture rows: the cache write needs __typename (Apollo normalization). */
const wire = (r: MaterialNodeMappingView) => ({ ...r, __typename: "MaterialNodeMapping" });
const wiredRows = () => ROWS.map(wire);
const wiredRowsAfter = () => ROWS.map((r) => wire({ ...r, status: r.id === "r-2" || r.id === "r-3" ? "confirmed" : r.status }));

const mappingsMock = {
  request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } },
  result: { data: { materialNodeMappings: wiredRows() } },
};

const refetchMock = {
  request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } },
  result: { data: { materialNodeMappings: wiredRowsAfter() } },
};

const confirmMock = {
  request: { query: ConfirmMappingProposalsDocument, variables: { input: { mappingIds: ["r-2", "r-3"] } } },
  result: { data: { confirmMappingProposals: { mappings: ROWS.filter((r) => r.id === "r-2" || r.id === "r-3").map(wire) } } },
};

const rejectMock = {
  request: { query: RejectMappingProposalsDocument, variables: { input: { mappingIds: ["r-2", "r-3"] } } },
  result: { data: { rejectMappingProposals: { mappings: ROWS.filter((r) => r.id === "r-2" || r.id === "r-3").map(wire) } } },
};

function mount(mocks: MockedResponse[] = [mappingsMock, confirmMock, rejectMock, refetchMock]) {
  return render(
    <MockedProvider mocks={mocks}>
      <LanguageProvider>
        <MaterialCoveragePanel material={MATERIAL} nodes={NODES} />
      </LanguageProvider>
    </MockedProvider>,
  );
}

describe("coverageGroups (delta decision 3 — every row in exactly one group)", () => {
  it("partitions confirmed/proposed/rejected/unmapped without overlap", () => {
    const groups = coverageGroups(ROWS);
    expect(groups.mapped.map((r) => r.id)).toEqual(["r-1"]);
    expect(groups.proposedGroups.map((g) => g.key)).toEqual(["title:Failure detection", "node:n-1"]);
    expect(groups.proposedGroups[0].rows.map((r) => r.id)).toEqual(["r-2", "r-3"]);
    expect(groups.proposedGroups[1].rows.map((r) => r.id)).toEqual(["r-4"]);
    expect(groups.rejected.map((r) => r.id)).toEqual(["r-5"]);
    expect(groups.unmapped.map((r) => r.id)).toEqual(["r-6"]);
    const placed = [
      ...groups.mapped,
      ...groups.proposedGroups.flatMap((g) => g.rows),
      ...groups.rejected,
      ...groups.unmapped,
    ].map((r) => r.id);
    expect(placed.sort()).toEqual(ROWS.map((r) => r.id).sort());
  });
});

describe("MaterialCoveragePanel", () => {
  it("renders the four groups from the mapping rows — section titles resolve, node titles too", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("Raft")).toBeInTheDocument());
    expect(screen.getByText("Chains")).toBeInTheDocument();
    expect(screen.getByText("Recipes")).toBeInTheDocument(); // the explicit Unmapped row — never dropped
    // The title group names itself twice (header + row); both must show.
    expect(screen.getAllByText(/Failure detection/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Consensus/).length).toBeGreaterThanOrEqual(2); // node title resolved from the plan's nodes
    expect(zhDict["mapping.groupMapped"]).toBe("已映射");
    expect(screen.getByText(zhDict["mapping.groupMapped"])).toBeInTheDocument();
    expect(screen.getByText(zhDict["mapping.groupUnmapped"])).toBeInTheDocument();
    expect(screen.getByText(zhDict["mapping.groupRejected"])).toBeInTheDocument();
  });

  it("confirms a proposed group in bulk — the group's row ids travel together", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("Chains")).toBeInTheDocument());
    // Two proposed groups (the title group, then the node-keyed one) each
    // carry verdict buttons; insertion order puts the title group first.
    fireEvent.click(screen.getAllByText(zhDict["mapping.confirmGroup"])[0]);
    await waitFor(() => expect(confirmMock.request.variables.input.mappingIds).toEqual(["r-2", "r-3"]));
  });

  it("rejects a proposed group in bulk", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("Chains")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(zhDict["mapping.rejectGroup"])[0]);
    await waitFor(() => expect(rejectMock.request.variables.input.mappingIds).toEqual(["r-2", "r-3"]));
  });

  it("names the honest empty state before the first map run", async () => {
    mount([
      { request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } }, result: { data: { materialNodeMappings: [] } } },
    ]);
    await waitFor(() => expect(screen.getByText(zhDict["mapping.noMappings"])).toBeInTheDocument());
    expect(screen.getByText(zhDict["mapping.mapAction"])).toBeInTheDocument();
  });

  it("renders a distinct failure state with retry when the mappings read errors — never the empty state", async () => {
    mount([
      { request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } }, error: new Error("network down") },
      // The retry consumes this follow-up read.
      { request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } }, result: { data: { materialNodeMappings: wiredRows() } } },
    ]);
    await waitFor(() => expect(screen.getByText(zhDict["mapping.loadFailed"])).toBeInTheDocument());
    expect(screen.queryByText(zhDict["mapping.noMappings"])).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(zhDict["mapping.retryLoad"]));
    await waitFor(() => expect(screen.getByText("Raft")).toBeInTheDocument());
    expect(screen.queryByText(zhDict["mapping.loadFailed"])).not.toBeInTheDocument();
  });

  it("resolves a confirmed group's NEW node to its title — confirm sweeps the plan read, no uuid fallback", async () => {
    // Production wiring under test: the panel's nodes prop rides the plan
    // read (usePlanNodesQuery → PlanDocument); confirm must refetch that
    // document or the created node never enters the plan cache and the
    // mapped row shows its raw uuid until remount.
    const wireNode = (id: string, title: string, order: number) => ({
      __typename: "KnowledgeNode",
      id,
      planId: "plan-1",
      taskId: null,
      stage: null,
      title,
      order,
      masteryScore: "0",
      state: "uncovered",
      createdAt: "2026-11-05T00:00:00Z",
    });
    const planData = (nodes: unknown[]) => ({
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
    const proposedOnly: MaterialNodeMappingView[] = [row({ id: "r-2", sectionId: "sec-2", proposedNodeTitle: "Failure detection" })];
    const confirmedOntoNewNode: MaterialNodeMappingView[] = [row({ id: "r-2", sectionId: "sec-2", status: "confirmed", nodeId: "node-9" })];

    function PlanFedPanel() {
      const planNodes = usePlanNodesQuery("plan-1").data;
      return <MaterialCoveragePanel material={MATERIAL} nodes={planNodes ?? []} />;
    }

    render(
      <MockedProvider
        mocks={[
          { request: { query: PlanDocument, variables: { id: "plan-1" } }, result: { data: planData([]) } },
          { request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } }, result: { data: { materialNodeMappings: proposedOnly.map(wire) } } },
          { request: { query: ConfirmMappingProposalsDocument, variables: { input: { mappingIds: ["r-2"] } } }, result: { data: { confirmMappingProposals: { mappings: confirmedOntoNewNode.map(wire) } } } },
          { request: { query: MaterialNodeMappingsDocument, variables: { materialId: "m-1" } }, result: { data: { materialNodeMappings: confirmedOntoNewNode.map(wire) } } },
          // The confirm mutation's refetchQueries sweep — WITHOUT this the
          // node-9 title never arrives and the mapped row shows the uuid.
          { request: { query: PlanDocument, variables: { id: "plan-1" } }, result: { data: planData([wireNode("node-9", "Failure detection", 1)]) } },
        ]}
      >
        <LanguageProvider>
          <PlanFedPanel />
        </LanguageProvider>
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByText("Chains")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(zhDict["mapping.confirmGroup"])[0]);
    // Gate on the confirm having landed: the proposed group (and its verdict
    // button) is gone once the row flipped to confirmed.
    await waitFor(() => expect(screen.queryByText(zhDict["mapping.confirmGroup"])).not.toBeInTheDocument());
    await waitFor(() => {
      // Settled state: the mapped row names the node TITLE (the plan sweep
      // landed) and the raw uuid never renders.
      expect(screen.getAllByText("Failure detection").length).toBeGreaterThan(0);
      expect(screen.queryByText("node-9")).not.toBeInTheDocument();
    });
  });
});

describe("mapping i18n namespace", () => {
  const zhKeys = Object.keys(zhDict).filter((key) => key.startsWith("mapping."));
  const enDict = (translations as Record<string, Record<string, string>>).en;

  it("exists in BOTH languages with identical key sets", () => {
    expect(zhKeys.length).toBeGreaterThan(10);
    for (const key of zhKeys) {
      expect(enDict[key], `en missing ${key}`).toBeTruthy();
    }
    const enKeys = Object.keys(enDict).filter((key) => key.startsWith("mapping."));
    expect(enKeys.sort()).toEqual(zhKeys.sort());
  });
});

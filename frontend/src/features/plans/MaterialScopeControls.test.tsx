import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { usePlanMaterialsQuery } from "@/api";
import { MaterialsDocument, SetMaterialScopeDocument } from "@/types/graphql";
import type { KnowledgeNodeView, MaterialView } from "@/api/views";
import MaterialScopeControls from "./MaterialScopeControls";

/**
 * MaterialScopeControls (FR-44, epic P2-10 T2 — component render seam,
 * MaterialCoveragePanel.test.tsx precedent): the scope chip reads the SERVER
 * fields (attachmentScope/nodeId — never recomputed), the pin picker offers
 * the plan's nodes ONLY, the mutations carry the exact wire inputs, the chip
 * flips from the read-back sweep (never optimistic guessing), failures map
 * the closed api enum through the sonner toast, task materials render
 * nothing (the task triangle has no node pinning), and the scope namespace
 * exists in BOTH dictionary languages.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), base: vi.fn() } }));

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const NODES: KnowledgeNodeView[] = [
  { id: "n-1", planId: "plan-1", taskId: null, stage: null, title: "Consensus", order: 0, masteryScore: "0", state: "uncovered" },
  { id: "n-2", planId: "plan-1", taskId: null, stage: null, title: "Gossip", order: 1, masteryScore: "0", state: "uncovered" },
  // A foreign-plan node — the picker must never offer it (the api refuses a
  // pin outside the material's plan).
  { id: "n-9", planId: "plan-2", taskId: null, stage: null, title: "Elsewhere", order: 0, masteryScore: "0", state: "uncovered" },
];

const wireMaterial = (scope: string, nodeId: string | null) => ({
  __typename: "Material",
  id: "m-1",
  title: "Distributed systems notes",
  kind: "markdown",
  sizeBytes: 1234,
  planId: "plan-1",
  taskId: null,
  attachmentScope: scope,
  nodeId,
  parseState: "parsed",
  parseFailureReason: null,
  sections: [],
  createdAt: "2026-11-05T00:00:00Z",
  downloadUrl: null,
});

const MATERIAL: MaterialView = {
  id: "m-1",
  title: "Distributed systems notes",
  kind: "markdown",
  sizeBytes: 1234,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: undefined,
  sections: [],
  createdAt: "2026-11-05T00:00:00Z",
  downloadUrl: null,
};

/** A real mini-parent: the row's material rides the Materials read like PlanHome's rows do. */
function RowHarness({ nodes }: { nodes: KnowledgeNodeView[] }) {
  const materials = usePlanMaterialsQuery("plan-1").data ?? [];
  return (
    <>
      {materials.map((material) => (
        <MaterialScopeControls key={material.id} material={material} nodes={nodes} />
      ))}
    </>
  );
}

function wireMaterialList(scope: string, nodeId: string | null) {
  return { materials: [wireMaterial(scope, nodeId)] };
}

const planWideMock = {
  request: { query: MaterialsDocument, variables: { planId: "plan-1" } },
  result: { data: { __typename: "Query", ...wireMaterialList("plan", null) } },
};

const pinnedMock = {
  request: { query: MaterialsDocument, variables: { planId: "plan-1" } },
  result: { data: { __typename: "Query", ...wireMaterialList("node", "n-1") } },
};

function mount(mocks: MockedResponse[], nodes: KnowledgeNodeView[] = NODES) {
  return render(
    <MockedProvider mocks={mocks}>
      <LanguageProvider>
        <RowHarness nodes={nodes} />
      </LanguageProvider>
    </MockedProvider>,
  );
}

describe("MaterialScopeControls (FR-44, epic P2-10 T2)", () => {
  it("renders the plan-wide chip for a plan-wide material and offers the pin action", async () => {
    mount([planWideMock]);

    await waitFor(() => expect(screen.getByTestId("scope-chip")).toHaveTextContent(zhDict["scope.chipPlan"]));
    expect(screen.getByTestId("scope-pin")).toBeInTheDocument();
    expect(screen.queryByTestId("scope-widen")).not.toBeInTheDocument();
  });

  it("renders the pinned chip with the node's TITLE and the widen action", async () => {
    mount([pinnedMock]);

    await waitFor(() =>
      expect(screen.getByTestId("scope-chip")).toHaveTextContent(
        zhDict["scope.chipNode"].replace("{node}", "Consensus"),
      ),
    );
    expect(screen.getByTestId("scope-widen")).toBeInTheDocument();
    expect(screen.queryByTestId("scope-pin")).not.toBeInTheDocument();
  });

  it("pins through the node picker limited to the plan's nodes — the wire input carries scope + nodeId", async () => {
    const pinMutation = {
      request: {
        query: SetMaterialScopeDocument,
        variables: { input: { materialId: "m-1", attachmentScope: "node", nodeId: "n-1" } },
      },
      result: { data: { setMaterialScope: { __typename: "SetMaterialScopePayload", material: wireMaterial("node", "n-1") } } },
    };
    mount([planWideMock, pinMutation, pinnedMock]);

    await waitFor(() => expect(screen.getByTestId("scope-pin")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("scope-pin"));

    const options = await screen.findAllByTestId("scope-node-option");
    expect(options.map((option) => option.textContent)).toEqual(["Consensus", "Gossip"]); // the foreign-plan node never offered
    fireEvent.click(screen.getByText("Consensus"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      zhDict["scope.pinnedToast"].replace("{node}", "Consensus"),
    ));
    // The chip flips from the READ-BACK sweep (the pinned Materials mock), not optimism.
    await waitFor(() =>
      expect(screen.getByTestId("scope-chip")).toHaveTextContent(
        zhDict["scope.chipNode"].replace("{node}", "Consensus"),
      ),
    );
    expect(screen.getByTestId("scope-widen")).toBeInTheDocument();
  });

  it("widens a pinned material back plan-wide — the wire input carries no nodeId", async () => {
    const widenMutation = {
      request: {
        query: SetMaterialScopeDocument,
        variables: { input: { materialId: "m-1", attachmentScope: "plan" } },
      },
      result: { data: { setMaterialScope: { __typename: "SetMaterialScopePayload", material: wireMaterial("plan", null) } } },
    };
    mount([pinnedMock, widenMutation, planWideMock]);

    await waitFor(() => expect(screen.getByTestId("scope-widen")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("scope-widen"));

    await waitFor(() => expect(widenMutation.request.variables.input).toEqual({ materialId: "m-1", attachmentScope: "plan" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zhDict["scope.widenedToast"]));
    await waitFor(() => expect(screen.getByTestId("scope-chip")).toHaveTextContent(zhDict["scope.chipPlan"]));
    expect(screen.queryByTestId("scope-widen")).not.toBeInTheDocument();
    expect(screen.getByTestId("scope-pin")).toBeInTheDocument();
  });

  it("maps a VALIDATION_FAILED failure to the scope error toast — the chip never flips optimistically", async () => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    const failingPin = {
      request: {
        query: SetMaterialScopeDocument,
        variables: { input: { materialId: "m-1", attachmentScope: "node", nodeId: "n-1" } },
      },
      // The Apollo 4 error model's wire shape (import-offer precedent):
      // extensions.code = the closed enum the toast map keys on.
      error: new CombinedGraphQLErrors({
        errors: [ { message: "pin refused", extensions: { code: "VALIDATION_FAILED" } } ],
      }),
    };
    mount([planWideMock, failingPin]);

    await waitFor(() => expect(screen.getByTestId("scope-pin")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("scope-pin"));
    fireEvent.click(await screen.findByText("Consensus"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zhDict["scope.errorValidation"]));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("scope-chip")).toHaveTextContent(zhDict["scope.chipPlan"]);
    expect(screen.queryByTestId("scope-widen")).not.toBeInTheDocument();
  });

  it("renders nothing for a task material (the task triangle has no node pinning)", () => {
    const taskMaterial: MaterialView = { ...MATERIAL, taskId: "task-1" };
    render(
      <MockedProvider>
        <LanguageProvider>
          <MaterialScopeControls material={taskMaterial} nodes={NODES} />
        </LanguageProvider>
      </MockedProvider>,
    );
    expect(screen.queryByTestId("scope-controls")).not.toBeInTheDocument();
  });
});

describe("scope i18n namespace", () => {
  const zhKeys = Object.keys(zhDict).filter((key) => key.startsWith("scope."));
  const enDict = (translations as Record<string, Record<string, string>>).en;

  it("exists in BOTH languages with identical key sets", () => {
    expect(zhKeys.length).toBeGreaterThan(10);
    for (const key of zhKeys) {
      expect(enDict[key], `en missing ${key}`).toBeTruthy();
    }
    const enKeys = Object.keys(enDict).filter((key) => key.startsWith("scope."));
    expect(enKeys.sort()).toEqual(zhKeys.sort());
  });
});

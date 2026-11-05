/**
 * The creation chat's visibility choice (FR-38, epic P2-11 T1): the create
 * confirm step carries a private/public choice (default PRIVATE — the Square
 * opt-in is explicit) with the same STRUCTURE-ONLY disclosure the plan-home
 * flip shows, and the selected value crosses the wire inside the createPlan
 * input. The seam is the mutation mock's recorded input (the client uuid is
 * dynamic, so the mock matches through a variableMatcher and the assertion
 * reads the captured input).
 */
import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal } from "@/ai/types";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { CreatePlanDocument } from "@/types/graphql";
import CreationChat from "./CreationChat";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const proposal: PlanStructureProposal = {
  topic: "软件工程",
  language: "zh",
  stages: [{ name: "阶段一：基础", nodeTitles: ["命令层"] }],
};

/** Records the createPlan input (clientUuid is dynamic — match anything). */
function createPlanMock(captured: { input?: Record<string, unknown> }): MockedResponse {
  return {
    request: {
      query: CreatePlanDocument,
      // The matcher both matches (any uuid) and captures the wire input.
      variables: (vars: { input: Record<string, unknown> }) => {
        captured.input = vars.input;
        return true;
      },
    },
    result: {
      data: {
        createPlan: {
          __typename: "CreatePlanPayload",
          plan: { __typename: "StudyPlan", id: "created-plan", topic: "软件工程", goal: null, createdAt: "2026-11-05T00:00:00Z", masteryScore: "0" },
          nodes: [],
        },
      },
    },
  };
}

async function reachProposalCard() {
  fireEvent.change(screen.getByPlaceholderText(zhDict["plans.topicPlaceholder"]), { target: { value: "软件工程" } });
  fireEvent.click(screen.getByRole("button", { name: zhDict["plans.send"] }));
  await waitFor(() => expect(screen.getByText("阶段一：基础")).toBeInTheDocument());
}

describe("CreationChat visibility choice (FR-38, epic P2-11 T1)", () => {
  beforeEach(() => {
    vi.spyOn(getCompanionService(), "generatePlanStructure").mockResolvedValue(proposal);
    localStorage.clear();
  });

  it("renders the private/public choice with the structure-only disclosure, private pre-selected", async () => {
    render(
      <MemoryRouter>
        <MockedProvider>
          <LanguageProvider>
            <CreationChat />
          </LanguageProvider>
        </MockedProvider>
      </MemoryRouter>,
    );
    await reachProposalCard();

    expect(screen.getByTestId("create-visibility-private").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("create-visibility-public").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(zhDict["visibility.disclosure"])).toBeInTheDocument();
  });

  it("sends the private default on the wire when the user never touches the choice", async () => {
    const captured: { input?: Record<string, unknown> } = {};
    render(
      <MemoryRouter>
        <MockedProvider mocks={[createPlanMock(captured)]}>
          <LanguageProvider>
            <CreationChat />
          </LanguageProvider>
        </MockedProvider>
      </MemoryRouter>,
    );
    await reachProposalCard();
    fireEvent.click(screen.getByRole("button", { name: zhDict["plans.confirmCreate"] }));

    await waitFor(() => expect(captured.input?.visibility).toEqual("private"));
    expect(screen.getByTestId("create-visibility-private").getAttribute("aria-checked")).toBe("true");
  });

  it("sends the picked public visibility on the wire (the explicit Square opt-in)", async () => {
    const captured: { input?: Record<string, unknown> } = {};
    render(
      <MemoryRouter>
        <MockedProvider mocks={[createPlanMock(captured)]}>
          <LanguageProvider>
            <CreationChat />
          </LanguageProvider>
        </MockedProvider>
      </MemoryRouter>,
    );
    await reachProposalCard();

    fireEvent.click(screen.getByTestId("create-visibility-public"));
    expect(screen.getByTestId("create-visibility-public").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("create-visibility-private").getAttribute("aria-checked")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: zhDict["plans.confirmCreate"] }));

    await waitFor(() => expect(captured.input?.visibility).toEqual("public"));
    expect(captured.input?.topic).toEqual("软件工程");
  });
});

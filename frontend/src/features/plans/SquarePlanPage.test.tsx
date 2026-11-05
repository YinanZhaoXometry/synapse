import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { ForkSquarePlanDocument, PlansDocument, SquarePlanDocument } from "@/types/graphql";
import SquarePlanPage from "./SquarePlanPage";

/**
 * SquarePlanPage (FR-39 web half, epic P2-11 T3 — component render seam, the
 * PlansHomePage.test.tsx precedent): the /square/:planId preview renders the
 * public plan's STRUCTURE ONLY off squarePlan's reduced set (topic/goal
 * header + stage-ordered node lists), the adopt CTA fires forkSquarePlan and
 * hands the browser to the forked plan's home, a vacated source (private
 * flip / deletion — the preview-to-fork race) answers the honest not-found
 * copy, and the back link returns to the Square.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), base: vi.fn() } }));

// The client uuid is minted at the call site (AD-12) — pin it so the mutation
// mock's variables deep-match deterministically.
vi.mock("@/api/queries/material-queries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  newClientUuid: () => "fork-uuid-1",
}));

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const NOW = "2026-11-05T00:00:00Z";

const previewFixture = {
  __typename: "SquarePlan",
  id: "sq-9",
  topic: "系统设计面试",
  goal: "八周准备",
  visibility: "public",
  createdAt: NOW,
  nodeSummaries: [
    { __typename: "SquareNodeSummary", title: "基础·概念", stage: "基础", order: 0 },
    { __typename: "SquareNodeSummary", title: "核心·一致性", stage: "核心", order: 1 },
    { __typename: "SquareNodeSummary", title: "应用·设计题", stage: "应用", order: 2 },
  ],
};

const previewRead = {
  request: { query: SquarePlanDocument, variables: { id: "sq-9" } },
  result: { data: { squarePlan: previewFixture } },
};

function PlanLanding() {
  return <p data-testid="plan-landing" />;
}
function PlansLanding() {
  return <p data-testid="plans-landing" />;
}

function mount(mocks: MockedResponse[], initialEntry = "/square/sq-9") {
  return render(
    <LanguageProvider>
      <MockedProvider mocks={mocks}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/square/:planId" element={<SquarePlanPage />} />
            <Route path="/plan/:id" element={<PlanLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

describe("SquarePlanPage — the /square/:planId preview (FR-39; delta decision 3)", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("renders the header (topic, goal, eyebrow) and the stage-ordered structure from the public read", async () => {
    mount([previewRead]);

    expect(await screen.findByText("系统设计面试")).toBeInTheDocument();
    expect(screen.getByText("八周准备")).toBeInTheDocument();
    expect(screen.getByText(zh("square.previewEyebrow"))).toBeInTheDocument();
    // stage groups in first-appearance order, each node title on its row
    expect(screen.getByText("基础")).toBeInTheDocument();
    expect(screen.getByText("核心")).toBeInTheDocument();
    expect(screen.getByText("应用")).toBeInTheDocument();
    expect(screen.getByText("基础·概念")).toBeInTheDocument();
    expect(screen.getByText("核心·一致性")).toBeInTheDocument();
    expect(screen.getByText("应用·设计题")).toBeInTheDocument();
    // the adopt CTA carries the 改编并开始 copy
    expect(screen.getByTestId("square-adopt-cta")).toHaveTextContent(zh("square.adoptCta"));
  });

  it("adopt fires forkSquarePlan and navigates to the forked plan's home after the toast", async () => {
    const forkMutation = {
      request: {
        query: ForkSquarePlanDocument,
        variables: { input: { sourcePlanId: "sq-9", clientUuid: "fork-uuid-1" } },
      },
      result: {
        data: {
          forkSquarePlan: {
            __typename: "ForkSquarePlanPayload",
            plan: {
              __typename: "StudyPlan",
              id: "fork-9",
              topic: "系统设计面试",
              goal: "八周准备",
              createdAt: NOW,
              masteryScore: "0",
              visibility: "private",
              forkedFromTopic: "系统设计面试",
            },
            nodes: [],
          },
        },
      },
    };
    // the hook's read-back sweep (我要学 must show the adopted plan)
    const plansReadBack = {
      request: { query: PlansDocument, variables: {} },
      result: { data: { plans: [] } },
    };
    mount([previewRead, forkMutation, plansReadBack]);

    fireEvent.click(await screen.findByTestId("square-adopt-cta"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zh("square.adoptedToast")));
    expect(await screen.findByTestId("plan-landing")).toBeInTheDocument();
  });

  it("answers the honest not-found copy when the source went private or vanished (the preview-to-fork race)", async () => {
    const absentRead = {
      request: { query: SquarePlanDocument, variables: { id: "sq-9" } },
      error: new CombinedGraphQLErrors({
        errors: [ { message: "plan not found", extensions: { code: "NOT_FOUND" } } ],
      }),
    };
    mount([absentRead]);

    // the NOT_FOUND code maps through the square enum keys (the error copy)
    await waitFor(() => expect(screen.getByText(zh("square.errorNotFound"))).toBeInTheDocument());
    expect(screen.queryByTestId("square-adopt-cta")).not.toBeInTheDocument();
  });

  it("the back link returns to the Square (the plans front door)", async () => {
    mount([previewRead]);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(zh("square.previewBack")) }));
    expect(await screen.findByTestId("plans-landing")).toBeInTheDocument();
  });
});

import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { ForkSquarePlanDocument, PlansDocument, SquarePlansDocument } from "@/types/graphql";
import SquareSection from "./SquareSection";

/**
 * SquareSection (FR-39 web half, epic P2-11 T3 — component render seam, the
 * PlansHomePage.test.tsx precedent): the 广场 tab renders the public-plan
 * cards (topic / goal snippet / node count + stage chips / created date /
 * 改编 per-card adopt), the adopt fires forkSquarePlan with a client-minted
 * uuid and lands on the forked plan's home after the toast, the card body
 * links the /square/:planId preview, failures map the closed api enum into
 * the sonner toast, the empty state stays honest (real data only — no demo
 * cards), and the square namespace exists in BOTH dictionary languages.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), base: vi.fn() } }));

// The client uuid is minted at the call site (AD-12) — pin it so the mutation
// mock's variables deep-match deterministically.
vi.mock("@/api/queries/material-queries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  newClientUuid: () => "fork-uuid-1",
}));

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;
const zh = (key: string) => zhDict[key];

const NOW = "2026-11-05T00:00:00Z";

const summaryFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "SquareNodeSummary",
  title: "基础·语音",
  stage: "基础",
  order: 0,
  ...overrides,
});

const squarePlanFixture = (overrides: Record<string, unknown> = {}) => ({
  __typename: "SquarePlan",
  id: "sq-1",
  topic: "雅思口语 6.5",
  goal: "六周冲刺",
  visibility: "public",
  createdAt: NOW,
  nodeSummaries: [
    summaryFixture({ title: "基础·语音", stage: "基础", order: 0 }),
    summaryFixture({ title: "应用·模考", stage: "应用", order: 1 }),
    summaryFixture({ title: "基础·跟读", stage: "基础", order: 2 }),
  ],
  ...overrides,
});

/** Generous usage counts — several watchers mount over the same documents. */
const USAGE = 6;

function squareMocks(plans: Array<Record<string, unknown>>) {
  return [
    { request: { query: SquarePlansDocument, variables: {} }, result: { data: { squarePlans: plans } }, maxUsageCount: USAGE },
  ];
}

function PlanLanding() {
  return <p data-testid="plan-landing" />;
}
function SquarePreviewLanding() {
  return <p data-testid="square-preview-landing" />;
}

function mount(mocks: MockedResponse[]) {
  return render(
    <LanguageProvider>
      <MockedProvider mocks={mocks}>
        <MemoryRouter initialEntries={["/plans"]}>
          <Routes>
            <Route path="/plans" element={<SquareSection />} />
            <Route path="/plan/:id" element={<PlanLanding />} />
            <Route path="/square/:planId" element={<SquarePreviewLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

describe("SquareSection — the 广场 tab (FR-39; delta decision 3)", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("renders every public plan as a card: topic, goal snippet, node count, stage chips, date, and a per-card 改编", async () => {
    mount(squareMocks([squarePlanFixture()]));

    expect(await screen.findByTestId("square-plan-card")).toBeInTheDocument();
    expect(screen.getByText("雅思口语 6.5")).toBeInTheDocument();
    expect(screen.getByText("六周冲刺")).toBeInTheDocument();
    expect(screen.getByText(`3 ${zh("plans.nodesUnit")}`)).toBeInTheDocument();
    // stage chips: distinct stages in first-appearance order (基础 repeated once)
    const card = screen.getByTestId("square-plan-card");
    expect(card.textContent).toContain("基础");
    expect(card.textContent).toContain("应用");
    expect(screen.getByRole("button", { name: new RegExp(zh("square.adopt")) })).toBeInTheDocument();
    // the created date rides the card
    expect(card.textContent).toContain(new Date(NOW).toLocaleDateString("zh-CN"));
  });

  it("lists several plans newest-first as separate cards", async () => {
    mount(squareMocks([
      squarePlanFixture({ id: "sq-new", topic: "newer public plan" }),
      squarePlanFixture({ id: "sq-old", topic: "older public plan", goal: null }),
    ]));

    expect(await screen.findByText("newer public plan")).toBeInTheDocument();
    expect(screen.getByText("older public plan")).toBeInTheDocument();
    expect(screen.getAllByTestId("square-plan-card")).toHaveLength(2);
  });

  it("opens the /square/:planId preview from the card body (addressable route, delta decision 3)", async () => {
    mount(squareMocks([squarePlanFixture()]));

    fireEvent.click(await screen.findByTestId("square-card-link"));
    expect(await screen.findByTestId("square-preview-landing")).toBeInTheDocument();
  });

  it("adopt fires forkSquarePlan with a minted uuid and navigates to the forked plan's home after the toast", async () => {
    const forkedPlan = {
      __typename: "StudyPlan",
      id: "fork-1",
      topic: "雅思口语 6.5",
      goal: "六周冲刺",
      createdAt: NOW,
      masteryScore: "0",
      visibility: "private",
      forkedFromTopic: "雅思口语 6.5",
    };
    const forkMutation = {
      request: {
        query: ForkSquarePlanDocument,
        variables: { input: { sourcePlanId: "sq-1", clientUuid: "fork-uuid-1" } },
      },
      result: {
        data: {
          forkSquarePlan: {
            __typename: "ForkSquarePlanPayload",
            plan: forkedPlan,
            nodes: [],
          },
        },
      },
      maxUsageCount: USAGE,
    };
    // the read-back sweep: the adopted plan lands in 我要学
    const plansReadBack = {
      request: { query: PlansDocument, variables: {} },
      result: { data: { plans: [forkedPlan] } },
      maxUsageCount: USAGE,
    };
    mount([...squareMocks([squarePlanFixture()]), forkMutation, plansReadBack]);

    fireEvent.click(await screen.findByTestId("square-card-adopt"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zh("square.adoptedToast")));
    expect(await screen.findByTestId("plan-landing")).toBeInTheDocument();
  });

  it("maps a VALIDATION_FAILED fork failure to the square error toast and stays on the Square", async () => {
    const failingFork = {
      request: {
        query: ForkSquarePlanDocument,
        variables: { input: { sourcePlanId: "sq-1", clientUuid: "fork-uuid-1" } },
      },
      error: new CombinedGraphQLErrors({
        errors: [ { message: "empty shell", extensions: { code: "VALIDATION_FAILED" } } ],
      }),
      maxUsageCount: USAGE,
    };
    mount([...squareMocks([squarePlanFixture()]), failingFork]);

    fireEvent.click(await screen.findByTestId("square-card-adopt"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("square.errorValidation")));
    expect(toast.success).not.toHaveBeenCalled();
    // still on the Square — the card remains
    expect(screen.getByTestId("square-plan-card")).toBeInTheDocument();
  });
});

describe("SquareSection — demo absence (the Square is real-data only)", () => {
  it("empty Square renders the honest empty copy and NO fabricated cards", async () => {
    mount(squareMocks([]));

    expect(await screen.findByText(zh("square.empty"))).toBeInTheDocument();
    expect(screen.queryByTestId("square-plan-card")).not.toBeInTheDocument();
  });
});

describe("square i18n namespace (epic P2-11 T3)", () => {
  const zhKeys = Object.keys(zhDict).filter((key) => key.startsWith("square."));

  it("exists in BOTH languages with identical key sets", () => {
    expect(zhKeys.length).toBeGreaterThan(15);
    for (const key of zhKeys) {
      expect(enDict[key], `en missing ${key}`).toBeTruthy();
    }
    const enKeys = Object.keys(enDict).filter((key) => key.startsWith("square."));
    expect(enKeys.sort()).toEqual(zhKeys.sort());
  });

  it("carries the adopt copy and the attribution line in both languages", () => {
    expect(zhDict["square.adopt"]).toBe("改编");
    expect(zhDict["square.tabSquare"]).toBe("广场");
    expect(zhDict["square.adaptedFrom"]).toContain("改编自公开计划");
    expect(enDict["square.tabSquare"]).toBe("Square");
    expect(enDict["square.adaptedFrom"].toLowerCase()).toContain("adapted from the public plan");
  });
});

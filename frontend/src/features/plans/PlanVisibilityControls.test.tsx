import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { usePlanQuery } from "@/api";
import { PlanDocument, SetPlanVisibilityDocument } from "@/types/graphql";
import PlanVisibilityControls from "./PlanVisibilityControls";

/**
 * PlanVisibilityControls (FR-38, epic P2-11 T1 — component render seam,
 * MaterialScopeControls.test.tsx precedent): the chip reads the SERVER
 * visibility column (never recomputed), the popover is the CONFIRM step and
 * carries the STRUCTURE-ONLY disclosure, the mutation carries the exact wire
 * input, the chip flips from the read-back sweep (never optimistic
 * guessing), failures map the closed api enum through the sonner toast, and
 * the visibility namespace exists in BOTH dictionary languages.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), base: vi.fn() } }));

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const wirePlan = (visibility: string) => ({
  __typename: "Query",
  plan: {
    __typename: "StudyPlan",
    id: "plan-1",
    topic: "Distributed systems",
    goal: null,
    createdAt: "2026-11-05T00:00:00Z",
    masteryScore: "42",
    visibility,
    nodes: [],
    materials: [],
  },
});

const planRead = (visibility: string) => ({
  request: { query: PlanDocument, variables: { id: "plan-1" } },
  result: { data: wirePlan(visibility) },
});

const flipMutation = (to: string) => ({
  request: { query: SetPlanVisibilityDocument, variables: { input: { planId: "plan-1", visibility: to } } },
  result: {
    data: {
      setPlanVisibility: {
        __typename: "SetPlanVisibilityPayload",
        plan: wirePlan(to).plan,
      },
    },
  },
});

/** A real mini-parent: the plan rides the Plan read like PlanHome's header does. */
function ControlsHarness({ planId }: { planId: string }) {
  const { data } = usePlanQuery(planId);
  if (!data) return null;
  return <PlanVisibilityControls plan={data.plan} />;
}

function mount(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <LanguageProvider>
        <ControlsHarness planId="plan-1" />
      </LanguageProvider>
    </MockedProvider>,
  );
}

describe("PlanVisibilityControls (FR-38, epic P2-11 T1)", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("renders the private chip for a private plan (the server column, not a guess)", async () => {
    mount([planRead("private")]);

    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPrivate"]));
    expect(screen.getByTestId("visibility-action")).toBeInTheDocument();
  });

  it("opens the confirm popover with the STRUCTURE-ONLY disclosure and a make-public confirm", async () => {
    mount([planRead("private")]);

    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("visibility-action"));

    expect(await screen.findByTestId("visibility-popover")).toBeInTheDocument();
    expect(screen.getByTestId("visibility-disclosure")).toHaveTextContent(
      zhDict["visibility.disclosure"].slice(0, 12),
    );
    expect(screen.getByTestId("visibility-confirm")).toHaveTextContent(zhDict["visibility.makePublic"]);
  });

  it("flips a private plan public through the mutation and the read-back sweep", async () => {
    const privateRead = planRead("private");
    const publicRead = planRead("public");
    const mutation = flipMutation("public");
    mount([privateRead, mutation, publicRead]);

    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPrivate"]));
    fireEvent.click(screen.getByTestId("visibility-action"));
    fireEvent.click(await screen.findByTestId("visibility-confirm"));

    await waitFor(() => expect(mutation.request.variables.input).toEqual({ planId: "plan-1", visibility: "public" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zhDict["visibility.publicToast"]));
    // The chip flips from the READ-BACK sweep (the public Plan re-read), not optimism.
    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPublic"]));
  });

  it("flips a public plan back private (the Square removal is a real op both ways)", async () => {
    const publicRead = planRead("public");
    const privateRead = planRead("private");
    const mutation = flipMutation("private");
    mount([publicRead, mutation, privateRead]);

    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPublic"]));
    fireEvent.click(screen.getByTestId("visibility-action"));
    const confirm = await screen.findByTestId("visibility-confirm");
    expect(confirm).toHaveTextContent(zhDict["visibility.makePrivate"]);
    fireEvent.click(confirm);

    await waitFor(() => expect(mutation.request.variables.input).toEqual({ planId: "plan-1", visibility: "private" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zhDict["visibility.privateToast"]));
    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPrivate"]));
  });

  it("maps a VALIDATION_FAILED failure to the visibility error toast — the chip never flips optimistically", async () => {
    const failingFlip = {
      request: { query: SetPlanVisibilityDocument, variables: { input: { planId: "plan-1", visibility: "public" } } },
      error: new CombinedGraphQLErrors({
        errors: [ { message: "flip refused", extensions: { code: "VALIDATION_FAILED" } } ],
      }),
    };
    mount([planRead("private"), failingFlip]);

    await waitFor(() => expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPrivate"]));
    fireEvent.click(screen.getByTestId("visibility-action"));
    fireEvent.click(await screen.findByTestId("visibility-confirm"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zhDict["visibility.errorValidation"]));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("visibility-chip")).toHaveTextContent(zhDict["visibility.chipPrivate"]);
  });
});

describe("visibility i18n namespace (epic P2-11 T1)", () => {
  const zhKeys = Object.keys(zhDict).filter((key) => key.startsWith("visibility."));
  const enDict = (translations as Record<string, Record<string, string>>).en;

  it("exists in BOTH languages with identical key sets", () => {
    expect(zhKeys.length).toBeGreaterThan(15);
    for (const key of zhKeys) {
      expect(enDict[key], `en missing ${key}`).toBeTruthy();
    }
    const enKeys = Object.keys(enDict).filter((key) => key.startsWith("visibility."));
    expect(enKeys.sort()).toEqual(zhKeys.sort());
  });

  it("carries the create-step choice key and the structure-only disclosure", () => {
    expect(zhDict["visibility.createLabel"]).toBeTruthy();
    expect(zhDict["visibility.disclosure"]).toContain("结构");
    expect(enDict["visibility.disclosure"].toLowerCase()).toContain("structure");
  });
});

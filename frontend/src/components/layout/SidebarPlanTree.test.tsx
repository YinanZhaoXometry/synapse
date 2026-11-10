import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlansDocument } from "@/types/graphql";
import SidebarPlanTree from "./SidebarPlanTree";

/**
 * The sidebar's plan records (epic-33 T1): recent plans render newest-first
 * under the 学习 group's fixed links, capped at 6 with a 查看全部 row; the
 * mastery chip renders the SERVER rollup verbatim (AD-14 — render, never
 * recompute); the active row follows the plan flow's nested routes; zero
 * plans or loading render nothing (honest-empty, fixed links never blocked).
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

const plansMock = (plans: Record<string, unknown>[]): MockedResponse => ({
  request: { query: PlansDocument, variables: {} },
  result: { data: { __typename: "Query", plans } },
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderTree(mocks: MockedResponse[], initialEntry = "/dashboard", onNavigate?: () => void) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LanguageProvider>
          <SidebarPlanTree onNavigate={onNavigate} />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    </MockedProvider>
  );
}

describe("SidebarPlanTree", () => {
  it("renders recent plans newest-first with the server mastery chip verbatim", async () => {
    renderTree([
      plansMock([
        wirePlan({ id: "plan-old", topic: "旧计划", createdAt: "2026-11-01T00:00:00Z" }),
        wirePlan({ id: "plan-new", topic: "新计划", createdAt: "2026-11-08T00:00:00Z", masteryScore: "87" }),
      ]),
    ]);
    const links = await screen.findAllByRole("link");
    // Newest first, then the 查看全部 tail row.
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/plan/plan-new",
      "/plan/plan-old",
      "/plans",
    ]);
    // AD-14: the chip is the server string, rendered — nothing recomputed.
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByLabelText("掌握度 87%")).toBeInTheDocument();
  });

  it("caps the tree at 6 rows plus 查看全部", async () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      wirePlan({ id: `plan-${index}`, topic: `计划 ${index}`, createdAt: `2026-11-0${index + 1}T00:00:00Z` })
    );
    renderTree([plansMock(many)]);
    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(7); // 6 recent + 查看全部
    expect(screen.getByRole("link", { name: "查看全部" })).toHaveAttribute("href", "/plans");
  });

  it("navigates on row click", async () => {
    const user = userEvent.setup();
    renderTree([plansMock([wirePlan({ id: "plan-9", topic: "可点击的计划" })])]);
    await user.click(await screen.findByRole("link", { name: /可点击的计划/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/plan/plan-9");
  });

  it("marks the open plan active, including its nested quiz/flashcards routes", async () => {
    renderTree([plansMock([wirePlan({ id: "plan-1" })])], "/plan/plan-1/quiz");
    const row = await screen.findByRole("link", { name: /分布一致性协议/ });
    expect(row).toHaveAttribute("aria-current", "page");
  });

  it("a sibling plan id is not active — no uuid-prefix collision", async () => {
    renderTree([plansMock([wirePlan({ id: "plan-1" })])], "/plan/plan-12/quiz");
    const row = await screen.findByRole("link", { name: /分布一致性协议/ });
    expect(row).not.toHaveAttribute("aria-current");
  });

  it("renders nothing at zero plans — the group keeps exactly its fixed links", async () => {
    renderTree([plansMock([])]);
    await waitFor(() => {
      expect(screen.queryByText("最近计划")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("forwards onNavigate (the mobile drawer's close) on row click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderTree([plansMock([wirePlan({ id: "plan-1" })])], "/dashboard", onNavigate);
    await user.click(await screen.findByRole("link", { name: /分布一致性协议/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

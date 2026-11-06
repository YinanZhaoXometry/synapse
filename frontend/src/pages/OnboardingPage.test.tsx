import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { PLANS_HOME_ROUTE } from "@/features/plans/entry-decision";
import OnboardingPage from "./OnboardingPage";

/**
 * OnboardingPage direct (epic P3-17 ticket 09): the first-run wizard's three
 * steps over the REAL flow — welcome → goal multi-select (continue gated on
 * at least one pick) → ready summary echoing the picks — plus the skip door
 * to /dashboard, the enter door to Plans Home, and the language toggle
 * actually switching the copy.
 */

const zh = translations.zh as Record<string, string>;
const en = translations.en as Record<string, string>;

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <LanguageProvider>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<div>dashboard-sentinel</div>} />
          <Route path={PLANS_HOME_ROUTE} element={<div>plans-sentinel</div>} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("OnboardingPage — the first-run wizard", () => {
  beforeEach(() => localStorage.clear());

  it("opens on the welcome step and offers the honest skip door", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    expect(screen.getByRole("heading", { name: zh["onboarding.welcomeTitle"] })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: zh["common.skip"] }));
    expect(screen.getByText("dashboard-sentinel")).toBeInTheDocument();
  });

  it("gates the goal step on at least one pick, then echoes the picks on ready", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: new RegExp(zh["onboarding.start"]) }));

    // Continue is disabled until a goal is picked; the pick hint shows.
    const continueBtn = screen.getByRole("button", { name: new RegExp(zh["common.continue"]) });
    expect(continueBtn).toBeDisabled();
    expect(screen.getByText(zh["onboarding.pickOne"])).toBeInTheDocument();

    // Multi-select: two goals toggle on (aria-pressed), continue unlocks.
    const exam = screen.getByRole("button", { name: new RegExp(zh["onboarding.goalExam"]) });
    const revise = screen.getByRole("button", { name: new RegExp(zh["onboarding.goalRevise"]) });
    await user.click(exam);
    await user.click(revise);
    expect(exam).toHaveAttribute("aria-pressed", "true");
    expect(revise).toHaveAttribute("aria-pressed", "true");
    expect(continueBtn).toBeEnabled();

    // Back keeps the wizard honest (step 0 again) — and the picks survive the
    // round trip (the draft is step state, not discarded).
    await user.click(screen.getByRole("button", { name: new RegExp(zh["common.back"]) }));
    expect(screen.getByRole("heading", { name: zh["onboarding.welcomeTitle"] })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: new RegExp(zh["onboarding.start"]) }));
    expect(exam).toHaveAttribute("aria-pressed", "true");
    // The step remounted — re-query the button before clicking it.
    await user.click(screen.getByRole("button", { name: new RegExp(zh["common.continue"]) }));

    expect(screen.getByRole("heading", { name: zh["onboarding.readyTitle"] })).toBeInTheDocument();
    expect(screen.getByText(zh["onboarding.goalExam"])).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: new RegExp(zh["onboarding.enter"]) }));
    expect(screen.getByText("plans-sentinel")).toBeInTheDocument();
  });

  it("switches the copy with the language toggle", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    expect(screen.getByRole("heading", { name: zh["onboarding.welcomeTitle"] })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: zh["common.switchLang"] }));
    expect(screen.getByRole("heading", { name: en["onboarding.welcomeTitle"] })).toBeInTheDocument();
  });
});

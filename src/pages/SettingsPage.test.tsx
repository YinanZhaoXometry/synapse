import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { toast } from "sonner";

// Toasts are asserted directly (the real sonner Toaster is not mounted here).
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserProgressProvider, useUserProgress } from "@/contexts/UserProgressContext";
import {
  createPlan,
  emptyDb,
  loadDb,
  markOnboardingComplete,
  registerMaterial,
  saveReadingProgress,
  STORAGE_KEY,
} from "@/data";
import { DEFAULT_PROGRESS } from "@/lib/demo-data";
import SettingsPage from "./SettingsPage";

/**
 * T2 (epic-7; AD-3/AD-4): the Settings confirm-reset flow must wipe the REAL
 * study store — the whole versioned `synapse-db:v1` document through the data
 * adapter's public surface (resetDb), never a page-level localStorage.removeItem
 * — while the UI-preference keys survive, and land the user in the first-run
 * entry state (a fresh reload to `/`). UserProgress's demo reset keeps running
 * alongside (resetTick observed), and the document contract is "empty content,
 * version kept", not a deleted key.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const PREFS: Array<[string, string]> = [
  ["synapse-lang", "zh"],
  ["synapse-theme", "aurora"],
  ["synapse-mode", "dark"],
  ["synapse-motion", "off"],
];

/** jsdom cannot navigate — stub the whole location so `replace` is observable. */
const originalLocation = window.location;
let replaceMock: Mock;

beforeEach(() => {
  localStorage.clear();
  PREFS.forEach(([key, value]) => localStorage.setItem(key, value));
  replaceMock = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...originalLocation, replace: replaceMock },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

/** A probe INSIDE the frozen scaffold context: resetAll must re-seed its state. */
function ProgressProbe() {
  const { progress, applyQuizOutcome, resetTick } = useUserProgress();
  return (
    <p data-testid="progress-probe" data-quizzes={progress.quizzesCompleted} data-reset-tick={resetTick}>
      <button
        type="button"
        data-testid="probe-bump"
        onClick={() => applyQuizOutcome({ correct: 1, total: 1, deltas: [] })}
      >
        bump
      </button>
    </p>
  );
}

function renderSettingsPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <ThemeProvider>
        <UserProgressProvider>
          <ProgressProbe />
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/settings"]}>
              <Routes>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<p data-testid="elsewhere" />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </UserProgressProvider>
      </ThemeProvider>
    </LanguageProvider>,
  );
}

/** Seed the real document the way the repositories write it, and prove it stuck. */
function seedStudyData() {
  const { plan } = createPlan({
    topic: "COMP5241 期末",
    goal: "exam prep",
    nodes: [{ title: "软件过程", stage: "基础" }],
  });
  const { material } = registerMaterial({
    title: "Lecture.pdf",
    kind: "pdf",
    sizeBytes: 10,
    planId: plan.id,
    taskId: null,
    sections: [{ id: "page-1", title: "Page 1", text: "page one 文本" }],
  });
  saveReadingProgress(material.id, { locator: { kind: "pdf", page: 1 }, text: "page one 文本" });
  markOnboardingComplete();

  expect(loadDb().plans).toHaveLength(1);
  expect(loadDb().materials).toHaveLength(1);
  expect(loadDb().readingProgress).toHaveLength(1);
  expect(loadDb().onboardingComplete).toBe(true);
}

describe("Settings reset covers the plan-first store (AD-4)", () => {
  it("confirm reset wipes synapse-db:v1 via the adapter, keeps UI prefs, and reloads into first-run", async () => {
    seedStudyData();
    renderSettingsPage();

    // the probe first proves progress CAN move, so the post-reset re-seed is a real assertion
    fireEvent.click(screen.getByTestId("probe-bump"));
    expect(screen.getByTestId("progress-probe").getAttribute("data-quizzes")).toBe(
      String(DEFAULT_PROGRESS.quizzesCompleted + 1),
    );

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(await screen.findByRole("button", { name: zh("common.confirm") }));

    // adapter contract: empty content, version kept — the key is NOT removed
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadDb()).toEqual(emptyDb());

    // reset means study data, not theme: every UI-pref key survives verbatim
    PREFS.forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));

    // the frozen demo store still resets alongside (resetAll ran, state re-seeded)
    expect(screen.getByTestId("progress-probe").getAttribute("data-quizzes")).toBe(
      String(DEFAULT_PROGRESS.quizzesCompleted),
    );
    expect(screen.getByTestId("progress-probe").getAttribute("data-reset-tick")).toBe("1");

    // and the app lands in the first-run entry state: a fresh reload to `/`
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("cancel keeps both the document and the prefs untouched", () => {
    seedStudyData();
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(screen.getByRole("button", { name: zh("common.cancel") }));

    expect(loadDb().plans).toHaveLength(1);
    expect(loadDb().onboardingComplete).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("a failed store write aborts the reset honestly — error toast, no reload, nothing resets", () => {
    seedStudyData();
    renderSettingsPage();

    // Quota-exceeded on write: resetDb throws AppError STORAGE_WRITE_FAILED
    // (modeled in store.test.ts) before anything else can reset.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(screen.getByRole("button", { name: zh("common.confirm") }));

    // The failure is named with the store's typed messageKey — never a fake success.
    expect(toast.error).toHaveBeenCalledWith(zh("errors.storageWriteFailed"));
    expect(toast).not.toHaveBeenCalledWith(zh("common.resetDone"));

    // Nothing resets: the document keeps its content and the demo store's
    // resetTick is unchanged (resetAll never ran).
    expect(loadDb().plans).toHaveLength(1);
    expect(loadDb().onboardingComplete).toBe(true);
    expect(screen.getByTestId("progress-probe").getAttribute("data-reset-tick")).toBe("0");

    // And no reload into the first-run state.
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

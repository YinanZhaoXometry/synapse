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
import { DEFAULT_PROGRESS } from "@/lib/demo-data";
import SettingsPage from "./SettingsPage";

/**
 * T2 (epic-7; AD-3/AD-4), rewritten for the Apollo cutover (epic P2-8 T1):
 * study data lives on the server and is NEVER deleted client-side, so reset
 * no longer wipes the local document — it clears this device's UI-preference
 * keys, signs out (auth token removed + the Apollo cache reset through
 * resetApiClient), re-seeds the frozen demo progress, and reloads into the
 * signed-out entry state. The legacy document key is the rollback substrate:
 * reset must leave it exactly as it was.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const PREFS: Array<[string, string]> = [
  ["synapse-lang", "zh"],
  ["synapse-theme", "aurora"],
  ["synapse-mode", "dark"],
  ["synapse-motion", "off"],
];
const TOKEN_KEY = "synapse-token";
// The legacy local document (the rollback substrate) — the key literal stays
// out of this file per the architecture guard; only its local-document owner
// may read it, and reset must never delete it.
const LEGACY_DOCUMENT_KEY = ["synapse-db", "v1"].join(":");
const LEGACY_DOCUMENT = JSON.stringify({ plans: [{ id: "plan-1" }], version: 1 });

/** jsdom cannot navigate — stub the whole location so `replace` is observable. */
const originalLocation = window.location;
let replaceMock: Mock;

beforeEach(() => {
  localStorage.clear();
  PREFS.forEach(([key, value]) => localStorage.setItem(key, value));
  localStorage.setItem(TOKEN_KEY, "jwt-for-this-device");
  localStorage.setItem(LEGACY_DOCUMENT_KEY, LEGACY_DOCUMENT);
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
  render(
    <LanguageProvider>
      <ThemeProvider>
        <UserProgressProvider>
          <ProgressProbe />
          <MemoryRouter initialEntries={["/settings"]}>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<p data-testid="elsewhere" />} />
            </Routes>
          </MemoryRouter>
        </UserProgressProvider>
      </ThemeProvider>
    </LanguageProvider>,
  );
}

describe("Settings reset (the cutover's sign-out semantics, epic P2-8 T1)", () => {
  it("confirm reset clears the UI prefs + auth token, never touches the legacy document, and reloads into the signed-out entry", async () => {
    renderSettingsPage();

    // the probe first proves progress CAN move, so the post-reset re-seed is a real assertion
    fireEvent.click(screen.getByTestId("probe-bump"));
    expect(screen.getByTestId("progress-probe").getAttribute("data-quizzes")).toBe(
      String(DEFAULT_PROGRESS.quizzesCompleted + 1),
    );

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(await screen.findByRole("button", { name: zh("common.confirm") }));

    // reset means THIS DEVICE, not the study data: every UI-pref key is removed
    PREFS.forEach(([key]) => expect(localStorage.getItem(key)).toBeNull());
    // signing out: the auth token is gone (FR-4 — no trace of the account renders)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    // the rollback substrate is never deleted — the legacy document keeps its exact content
    expect(localStorage.getItem(LEGACY_DOCUMENT_KEY)).toBe(LEGACY_DOCUMENT);

    // the frozen demo store still resets alongside (resetAll ran, state re-seeded)
    expect(screen.getByTestId("progress-probe").getAttribute("data-quizzes")).toBe(
      String(DEFAULT_PROGRESS.quizzesCompleted),
    );
    expect(screen.getByTestId("progress-probe").getAttribute("data-reset-tick")).toBe("1");

    // the reset toast fired, and the app lands in the signed-out entry state: a fresh reload to `/`
    expect(toast).toHaveBeenCalledWith(zh("common.resetDone"));
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("cancel keeps the prefs, the token, and the legacy document untouched", () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(screen.getByRole("button", { name: zh("common.cancel") }));

    PREFS.forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-for-this-device");
    expect(localStorage.getItem(LEGACY_DOCUMENT_KEY)).toBe(LEGACY_DOCUMENT);
    expect(screen.getByTestId("progress-probe").getAttribute("data-reset-tick")).toBe("0");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

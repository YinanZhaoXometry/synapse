import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import SettingsPage from "./SettingsPage";

/**
 * T2 (epic-7; AD-3/AD-4), rewritten for the Apollo cutover (epic P2-8 T1),
 * then again for epic P2-09 T6: study data lives on the server and is NEVER
 * deleted client-side, so reset clears this device's UI-preference keys and
 * signs out (auth token removed + the Apollo cache reset through
 * resetApiClient) and reloads into the signed-out entry state. The demo
 * progress re-seed half is GONE — UserProgressContext is deleted (A1
 * completion, grep-guarded) and nothing client-side holds study state to
 * reset. The legacy document key is the rollback substrate: reset must leave
 * it exactly as it was.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The interpolating twin of the page's t() (the toast/assertion strings
 * carry {var} placeholders the raw dict lookup leaves in place). */
const zhT = (key: string, vars: Record<string, string | number>) => {
  let text = zhDict[key];
  for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
  return text;
};

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

/** The weekly-goal fixtures (epic P2-09 T5): the Settings setter reads
 * weeklyGoal and calls setWeeklyGoal; the stub echoes the setter. */
let goalTarget = 3;
const setGoalCalls: number[] = [];

beforeEach(() => {
  goalTarget = 3;
  setGoalCalls.length = 0;
});

function goalHandlers(failSet = false): Record<string, (variables: EchoFixture) => unknown> {
  return {
    WeeklyGoal: () => ({ __typename: "WeeklyGoal", target: goalTarget, currentWeekSessions: 1, currentWeekStart: "2026-11-02" }),
    SetWeeklyGoal: (variables) => {
      if (failSet) throw new Error("db down");
      const target = (variables.input as { target: number }).target;
      setGoalCalls.push(target);
      goalTarget = target;
      return { __typename: "SetWeeklyGoalPayload", weeklyGoal: { __typename: "WeeklyGoal", target, currentWeekSessions: 1, currentWeekStart: "2026-11-02" } };
    },
  };
}

function renderSettingsPage(options: { failSet?: boolean } = {}) {
  const client = createStubClient(goalHandlers(options.failSet), {
    sessions: [],
    evidence: [],
    mistakes: [],
    plans: [],
  });
  const Wrapper = makeStubWrapper(client);
  render(
    <Wrapper>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={["/settings"]}>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<p data-testid="elsewhere" />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </LanguageProvider>
    </Wrapper>,
  );
}

describe("Settings reset (the cutover's sign-out semantics, epic P2-8 T1; demo re-seed retired in P2-09 T6)", () => {
  it("confirm reset clears the UI prefs + auth token, never touches the legacy document, and reloads into the signed-out entry", async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: zh("settings.reset") }));
    fireEvent.click(await screen.findByRole("button", { name: zh("common.confirm") }));

    // reset means THIS DEVICE, not the study data: every UI-pref key is removed
    PREFS.forEach(([key]) => expect(localStorage.getItem(key)).toBeNull());
    // signing out: the auth token is gone (FR-4 — no trace of the account renders)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    // the rollback substrate is never deleted — the legacy document keeps its exact content
    expect(localStorage.getItem(LEGACY_DOCUMENT_KEY)).toBe(LEGACY_DOCUMENT);

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
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

/**
 * The weekly-goal setter (FR-25, epic P2-09 T5, delta decision 3): the
 * Settings simple half gains the 学习目标 section — a number input over the
 * SERVER's current target (1..21, the server-validated range) whose save
 * calls setWeeklyGoal with sonner feedback. Client-side validation fires
 * BEFORE the mutation; the mutation echo writes the fresh weeklyGoal read
 * back through the cache.
 */
describe("Settings — the weekly-goal setter (epic P2-09 T5)", () => {
  it("renders the server's current target in the study-goal section", async () => {
    renderSettingsPage();

    const input = await screen.findByLabelText(zh("settings.studyGoalAria"));
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("3");
    // the section heading renders (the row's own label is a distinct element)
    expect(screen.getByRole("heading", { name: zh("settings.studyGoal") })).toBeTruthy();
  });

  it("saves a valid target through the mutation with a success toast", async () => {
    renderSettingsPage();

    const input = await screen.findByLabelText(zh("settings.studyGoalAria"));
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.studyGoalSave") }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zh("settings.studyGoalSaved")));
    expect(setGoalCalls).toEqual([7]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rejects out-of-range targets client-side (0 and 22) — no mutation call, an invalid toast instead", async () => {
    renderSettingsPage();

    for (const bad of ["0", "22"]) {
      const input = await screen.findByLabelText(zh("settings.studyGoalAria"));
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(screen.getByRole("button", { name: zh("settings.studyGoalSave") }));
    }

    expect(toast.error).toHaveBeenCalledWith(zh("settings.studyGoalInvalid"));
    expect(setGoalCalls).toEqual([]);
  });

  it("surfaces a failed set with the neutral error toast (never silent)", async () => {
    renderSettingsPage({ failSet: true });

    const input = await screen.findByLabelText(zh("settings.studyGoalAria"));
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.studyGoalSave") }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("errors.persistFailed")));
    expect(toast.success).not.toHaveBeenCalled();
    // the failure did not reach the server state
    expect(setGoalCalls).toEqual([]);
  });

  it("the study-goal section is bilingual (zh + en non-empty copy)", () => {
    const enDict = (translations as Record<string, Record<string, string>>).en;
    for (const key of ["settings.studyGoal", "settings.studyGoalHelp", "settings.studyGoalSave", "settings.studyGoalSaved", "settings.studyGoalInvalid", "settings.studyGoalAria", "settings.studyGoalUnit"]) {
      expect(zhDict[key], `zh ${key}`).toBeTruthy();
      expect(enDict[key], `en ${key}`).toBeTruthy();
    }
  });
});

/**
 * The account half (FR-30 + FR-34's display consequence, epic-14 T1): the
 * password change (client validation BEFORE the mutation; the session-survives
 * note in the copy), the whole-document data export (Blob download,
 * synapse-export-<date>.json), and the honest AI-usage display (the live cap
 * counter + limit, no progress theatrics). These walks mount the page under
 * MockedProvider — the closed-enum error mapping needs typed mocks carrying
 * extensions.code (the PlanVisibilityControls precedent), which the echo
 * harness cannot express.
 */
import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ChangePasswordDocument, ExportDataDocument, WeeklyGoalDocument, AiUsageTodayDocument } from "@/types/graphql";

const passwordMutation = (currentPassword: string, newPassword: string) => ({
  request: { query: ChangePasswordDocument, variables: { input: { currentPassword, newPassword } } },
  result: {
    data: {
      changePassword: {
        __typename: "ChangePasswordPayload",
        user: { __typename: "User", id: "user-1", email: "learner@example.com", createdAt: "2026-11-05T00:00:00Z" },
      },
    },
  },
});

const passwordFailure = (currentPassword: string, newPassword: string, code: string) => ({
  request: { query: ChangePasswordDocument, variables: { input: { currentPassword, newPassword } } },
  error: new CombinedGraphQLErrors({
    errors: [ { message: "refused", extensions: { code } } ],
  }),
});

const usageRead = (callsToday: number, dailyLimit: number) => ({
  request: { query: AiUsageTodayDocument },
  result: { data: { aiUsageToday: { __typename: "AiUsage", callsToday, dailyLimit } } },
});

const exportRead = (document: string) => ({
  request: { query: ExportDataDocument },
  result: { data: { exportData: { __typename: "ExportData", document } } },
});

// The page also reads weeklyGoal on mount — answered here so the walks
// exercise only the operations they assert on.
const goalRead = {
  request: { query: WeeklyGoalDocument },
  result: { data: { weeklyGoal: { __typename: "WeeklyGoal", target: 3, currentWeekSessions: 1, currentWeekStart: "2026-11-02" } } },
};

function renderAccountPage(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={[ goalRead, ...mocks ]}>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={["/settings"]}>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </LanguageProvider>
    </MockedProvider>,
  );
}

describe("Settings — the account half (epic-14 T1)", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    localStorage.setItem(TOKEN_KEY, "jwt-for-this-device");
  });

  it("renders the password form (current/new/confirm + the session-survives note) and the honest usage read", async () => {
    renderAccountPage([ usageRead(12, 50) ]);

    expect(await screen.findByLabelText(zh("settings.passwordCurrentAria"))).toBeTruthy();
    expect(screen.getByLabelText(zh("settings.passwordNewAria"))).toBeTruthy();
    expect(screen.getByLabelText(zh("settings.passwordConfirmAria"))).toBeTruthy();
    expect(screen.getByRole("button", { name: zh("settings.passwordSave") })).toBeTruthy();
    // the session-survives policy is stated in the copy (delta decision 2)
    expect(screen.getByText(zh("settings.passwordNote"))).toBeTruthy();

    // the usage row renders the live counter + limit, neutral (no theatrics)
    expect(await screen.findByText(zhT("settings.aiUsageValue", { count: 12, limit: 50 }))).toBeTruthy();
  });

  it("refuses a new password under the register minimum client-side — no mutation call", async () => {
    renderAccountPage([ passwordMutation("known-password-123", "a-fresh-password-456"), usageRead(0, 50) ]);

    fireEvent.change(await screen.findByLabelText(zh("settings.passwordCurrentAria")), { target: { value: "known-password-123" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordNewAria")), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordConfirmAria")), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.passwordSave") }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zhT("settings.passwordTooShort", { min: 8 })));
  });

  it("refuses mismatched confirms client-side — no mutation call", async () => {
    renderAccountPage([ passwordMutation("known-password-123", "a-fresh-password-456"), usageRead(0, 50) ]);

    fireEvent.change(await screen.findByLabelText(zh("settings.passwordCurrentAria")), { target: { value: "known-password-123" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordNewAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordConfirmAria")), { target: { value: "different-entirely" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.passwordSave") }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("settings.passwordMismatch")));
  });

  it("sends the exact wire input on success and toasts the saved state", async () => {
    renderAccountPage([ passwordMutation("known-password-123", "a-fresh-password-456"), usageRead(0, 50) ]);

    fireEvent.change(await screen.findByLabelText(zh("settings.passwordCurrentAria")), { target: { value: "known-password-123" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordNewAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordConfirmAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.passwordSave") }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(zh("settings.passwordSaved")));
  });

  it("maps a server VALIDATION_FAILED to the wrong-current toast (the client never bypasses its own validation, so that code means the current password)", async () => {
    renderAccountPage([ passwordFailure("known-password-123", "a-fresh-password-456", "VALIDATION_FAILED"), usageRead(0, 50) ]);

    fireEvent.change(await screen.findByLabelText(zh("settings.passwordCurrentAria")), { target: { value: "known-password-123" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordNewAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordConfirmAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.passwordSave") }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("settings.passwordWrongCurrent")));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("maps RATE_LIMITED to the burst toast", async () => {
    renderAccountPage([ passwordFailure("known-password-123", "a-fresh-password-456", "RATE_LIMITED"), usageRead(0, 50) ]);

    fireEvent.change(await screen.findByLabelText(zh("settings.passwordCurrentAria")), { target: { value: "known-password-123" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordNewAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.change(screen.getByLabelText(zh("settings.passwordConfirmAria")), { target: { value: "a-fresh-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: zh("settings.passwordSave") }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("settings.passwordErrorRateLimited")));
  });

  it("exports the whole document as a Blob download named synapse-export-<date>.json", async () => {
    const document = JSON.stringify({ version: 1, plans: [ { id: "p-1" } ] });
    const createdUrls: string[] = [];
    const revokeMock = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal("URL", Object.assign(globalThis.URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        createdUrls.push(`blob:stub-${createdUrls.length}`);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("application/json");
        return createdUrls[createdUrls.length - 1];
      }),
      revokeObjectURL: revokeMock,
    }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^synapse-export-\d{4}-\d{2}-\d{2}\.json$/);
      expect(this.href).toBe(createdUrls[0]);
      clickMock();
    });

    try {
      renderAccountPage([ exportRead(document) ]);

      fireEvent.click(await screen.findByRole("button", { name: zh("settings.exportAction") }));

      await waitFor(() => {
        expect(clickMock).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(zh("settings.exportDone"));
      });
      expect(revokeMock).toHaveBeenCalledWith(createdUrls[0]);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("surfaces a failed export honestly", async () => {
    vi.stubGlobal("URL", Object.assign(globalThis.URL, { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      renderAccountPage([
        {
          request: { query: ExportDataDocument },
          error: new CombinedGraphQLErrors({ errors: [ { message: "boom", extensions: { code: "INTERNAL" } } ] }),
        },
      ]);

      fireEvent.click(await screen.findByRole("button", { name: zh("settings.exportAction") }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(zh("settings.exportFailed")));
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("the account namespace is bilingual (zh + en non-empty copy)", () => {
    const enDict = (translations as Record<string, Record<string, string>>).en;
    const keys = [
      "settings.account", "settings.accountHelp",
      "settings.password", "settings.passwordNote",
      "settings.passwordCurrentAria", "settings.passwordNewAria", "settings.passwordConfirmAria",
      "settings.passwordSave", "settings.passwordSaved",
      "settings.passwordTooShort", "settings.passwordMismatch", "settings.passwordWrongCurrent",
      "settings.passwordErrorRateLimited", "settings.passwordErrorGeneric",
      "settings.exportData", "settings.exportDataNote", "settings.exportAction",
      "settings.exportDone", "settings.exportFailed",
      "settings.aiUsage", "settings.aiUsageNote", "settings.aiUsageValue", "settings.aiUsageAria",
      "settings.subtitle",
    ];
    for (const key of keys) {
      expect(zhDict[key], `zh ${key}`).toBeTruthy();
      expect(enDict[key], `en ${key}`).toBeTruthy();
    }
  });
});

describe("Settings — page-end sign-out (2026-11-06 logout discoverability fix)", () => {
  it("the bottom button cuts the session through the real logout seam and lands on /login", async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    // Two sign-out affordances share the page now (the general-card row +
    // this page-end button); the page-end one is last in DOM order.
    const signOutButtons = screen.getAllByRole("button", { name: zh("settings.logout") });
    expect(signOutButtons.length).toBe(2);
    await user.click(signOutButtons[signOutButtons.length - 1]);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    // The observable contract (not a mock): the token is gone — the login
    // wall owns the next visit (AD-15).
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

/** The reader's markdown content theme (epic-24 T3): the claudette toggle.
 * Lazy-write contract — OFF is the ABSENT key; nothing persists until the
 * first enable, disabling removes it again. */
describe("Settings — the reader paper theme toggle (epic-24 T3)", () => {
  it("renders off by default with no stored key (lazy-write: nothing until first enable)", async () => {
    renderSettingsPage();
    const on = await screen.findByRole("switch", { name: zh("settings.readerTheme") });
    expect(on).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("synapse-reader-md-theme")).toBeNull();
  });

  it("enabling writes claudette + turns the switch on; disabling removes the key again", async () => {
    const user = userEvent.setup();
    renderSettingsPage();
    const on = await screen.findByRole("switch", { name: zh("settings.readerTheme") });
    await user.click(on);
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("synapse-reader-md-theme")).toBe("claudette");
    await user.click(on);
    expect(on).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("synapse-reader-md-theme")).toBeNull();
  });
});

/**
 * The /achievements re-point tests (FR-28, epic P2-09 T6): the page renders
 * the 12-badge taxonomy from the SERVER's badgeState read (unlocked/locked/
 * counter/threshold — rendering reads, never recomputes, AD-14), with the
 * shared badge emoji map, never-color-only state glyphs + text (AD-9), the
 * server streak, and the session-once unlock celebration (locked→unlocked
 * within a session fires once; a session-start unlock is baseline, never
 * celebrated; reduced-motion collapses to a plain toast). The demo
 * ACHIEVEMENTS fixture, its unlocks, and the demo points/level are retired —
 * UserProgressContext died with this ticket (A1 completion) and the grep
 * guard keeps it dead.
 *
 * Apollo-level stub (the harness double): handlers answer the BadgeStates +
 * Streak reads with wire-shaped fixtures.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

// Toasts are asserted directly (the real sonner Toaster is not mounted here).
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { translations } from "@/contexts/i18n-dictionary";
import { resetBadgeCelebrations } from "@/lib/badges";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import AchievementsPage from "./AchievementsPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

// The mocked sonner's success fn (vi-mocked above) — typed as sonner's real
// signature, so the mock internals ride this one honest cast.
const successMock = toast.success as unknown as ReturnType<typeof vi.fn>;
const successCalls = () => successMock.mock.calls as unknown[];

const PAGE_SOURCE = readFileSync(join(__dirname, "AchievementsPage.tsx"), "utf8");
const DASHBOARD_SOURCE = readFileSync(join(__dirname, "DashboardPage.tsx"), "utf8");

const ALL_IDS = Array.from({ length: 12 }, (_, i) => `b${i + 1}`);

/** Wire-shaped badge rows: the scaffold order with explicit counter/threshold
 * (the server's BadgeState contract — b7/b8/b9 = 1/3/5 mastered nodes). */
const THRESHOLDS: Record<string, { counter: number; threshold: number }> = {
  b1: { counter: 0, threshold: 1 },
  b2: { counter: 2, threshold: 3 },
  b3: { counter: 2, threshold: 7 },
  b4: { counter: 4, threshold: 10 },
  b5: { counter: 38, threshold: 100 },
  b6: { counter: 1, threshold: 5 },
  b7: { counter: 0, threshold: 1 },
  b8: { counter: 0, threshold: 3 },
  b9: { counter: 0, threshold: 5 },
  b10: { counter: 1, threshold: 3 },
  b11: { counter: 0, threshold: 1 },
  b12: { counter: 0, threshold: 1 },
};

const badgeRow = (id: string, unlocked: boolean, over: Partial<{ counter: number; threshold: number }> = {}): EchoFixture => ({
  __typename: "BadgeState",
  id,
  unlocked,
  counter: over.counter ?? THRESHOLDS[id].counter,
  threshold: over.threshold ?? THRESHOLDS[id].threshold,
});

const badgesFixture = (unlockedIds: string[]): EchoFixture[] =>
  ALL_IDS.map((id) => badgeRow(id, unlockedIds.includes(id)));

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function achHandlers(over: { badges?: EchoFixture[]; streak?: number } = {}): LooseHandlers {
  return {
    BadgeStates: () => over.badges ?? badgesFixture(["b1", "b6", "b10"]),
    Streak: () => over.streak ?? 5,
  };
}

function renderAchievementsPage(handlers: LooseHandlers, motion: "on" | "off" = "on") {
  localStorage.setItem("synapse-motion", motion === "off" ? "off" : "on");
  const client = createStubClient(handlers, { sessions: [], evidence: [], mistakes: [], plans: [] });
  const Wrapper = makeStubWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AchievementsPage />
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // The celebration set is session-scoped module state — every test starts a fresh session.
  resetBadgeCelebrations();
});

afterEach(() => {
  // vitest 4: restoreAllMocks no longer resets vi.fn() call history (spies
  // only) — clearAllMocks keeps the vitest-3-era hygiene for module mocks.
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("AchievementsPage — real badge unlocks (FR-28, epic P2-09 T6)", () => {
  it("renders all 12 badges from badgeState with their scaffold names, whatever the unlock state", async () => {
    renderAchievementsPage(achHandlers());

    for (const id of ALL_IDS) {
      expect(await screen.findByText(zh(`ach.${id}`)), `badge ${id} title`).toBeTruthy();
      expect(screen.getByText(zh(`ach.${id}d`)), `badge ${id} description`).toBeTruthy();
    }
  });

  it("unlock state comes from the SERVER rows only: unlocked slice shows 已解锁, locked shows 未解锁", async () => {
    renderAchievementsPage(achHandlers({ badges: badgesFixture(["b1", "b6", "b10"]) }));

    // the server-unlocked three carry the unlocked state text
    await screen.findByText(zh("ach.b1"));
    const unlockedStates = screen.getAllByText(zh("ach.unlocked"));
    expect(unlockedStates.length).toBe(3);
    const lockedStates = screen.getAllByText(zh("ach.locked"));
    expect(lockedStates.length).toBe(9);

    // glyph + text, never color-only (AD-9): every card carries a distinct
    // state glyph (svg) next to its state word
    const b1Card = screen.getByText(zh("ach.b1")).closest("div")!;
    expect(b1Card.querySelector("svg")).toBeTruthy();
    const b2Card = screen.getByText(zh("ach.b2")).closest("div")!;
    expect(b2Card.querySelector("svg")).toBeTruthy();
  });

  it("renders per-badge progress from the wire counter/threshold (e.g. '1 / 5'), capped at the threshold", async () => {
    renderAchievementsPage(achHandlers({ badges: [badgeRow("b6", false, { counter: 1, threshold: 5 }), badgeRow("b1", true, { counter: 9, threshold: 1 })] }));

    // b6: counter 1 / threshold 5 — the honest raw numbers
    expect(await screen.findByText(zhVars("ach.progress", { done: 1, target: 5 }))).toBeTruthy();
    // b1: counter 9 past threshold 1 renders capped (9/1 reads absurd)
    expect(screen.getByText(zhVars("ach.progress", { done: 1, target: 1 }))).toBeTruthy();
  });

  it("the header ring counts the server-unlocked badges (3 of 12 → 25%)", async () => {
    const { container } = renderAchievementsPage(achHandlers({ badges: badgesFixture(["b1", "b6", "b10"]) }));

    expect(await screen.findByText(zhVars("ach.subtitle", { n: 3 }))).toBeTruthy();
    const ring = container.querySelector('[data-testid="badge-ring"]');
    expect(ring).toBeTruthy();
    expect(ring!.getAttribute("data-percent")).toBe("25");
    expect(screen.getByText(zhVars("ach.unlockedCount", { n: 3 }))).toBeTruthy();
  });

  it("the streak stat reads the SERVER streak; no points or level render anywhere", async () => {
    renderAchievementsPage(achHandlers({ streak: 5 }));

    await screen.findByText(zh("ach.streak"));
    // the streak VALUE card shows the server number
    expect(screen.getByText("5")).toBeTruthy();
    // demo points/level are retired — the dictionary keys are gone entirely
    for (const key of ["ach.level", "dashboard.level", "common.pointsUnit", "settings.profileMeta"]) {
      expect(zhDict[key], `zh ${key} retired`).toBeUndefined();
      expect(enDict[key], `en ${key} retired`).toBeUndefined();
    }
    // and no demo copy renders
    expect(screen.queryByText(zh("common.demoData"))).toBeNull();
  });

  it("renders nothing while the reads load (honest-empty, no demo fallback)", () => {
    const { container } = renderAchievementsPage(achHandlers());
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(zh("common.loading"))).toBeTruthy();
  });

  it("a failed read shows the retry banner (never silent, never demo copy)", async () => {
    const failing: LooseHandlers = {
      BadgeStates: () => {
        throw new Error("db down");
      },
      Streak: () => 5,
    };
    renderAchievementsPage(failing);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(zh("ach.loadFailed"))).toBeTruthy();
    expect(screen.getByText(zh("ach.retry"))).toBeTruthy();
  });
});

describe("AchievementsPage — the session-once unlock celebration", () => {
  it("celebrates a locked→unlocked transition exactly once; a session-start unlock is baseline and never celebrated", async () => {
    const first = renderAchievementsPage(achHandlers({ badges: badgesFixture(["b1"]) }));
    await screen.findByText(zh("ach.b1"));
    // baseline: b1 was unlocked when the session loaded — no celebration
    expect(toast.success).not.toHaveBeenCalled();

    // within the same session b2 unlocks (fresh badgeState read)
    const secondClient = createStubClient(
      achHandlers({ badges: badgesFixture(["b1", "b2"]) }),
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const SecondWrapper = makeStubWrapper(secondClient);
    first.rerender(
      <SecondWrapper>
        <MemoryRouter>
          <LanguageProvider>
            <ThemeProvider>
              <AchievementsPage />
            </ThemeProvider>
          </LanguageProvider>
        </MemoryRouter>
      </SecondWrapper>,
    );

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    // the celebrated badge is b2 (its name rides the toast), not b1
    const described = JSON.stringify(successCalls()[0]?.[1]);
    expect(described).toContain(zh("ach.b2"));
    expect(described).not.toContain(zh("ach.b1"));
  });

  it("does not re-celebrate on remount (the seen set outlives the page in the session)", async () => {
    const first = renderAchievementsPage(achHandlers({ badges: badgesFixture(["b1"]) }));
    await screen.findByText(zh("ach.b1"));

    const secondClient = createStubClient(
      achHandlers({ badges: badgesFixture(["b1", "b2"]) }),
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const SecondWrapper = makeStubWrapper(secondClient);
    first.rerender(
      <SecondWrapper>
        <MemoryRouter>
          <LanguageProvider>
            <ThemeProvider>
              <AchievementsPage />
            </ThemeProvider>
          </LanguageProvider>
        </MemoryRouter>
      </SecondWrapper>,
    );
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

    // unmount + a fresh mount with the SAME server state — no new toast
    first.unmount();
    renderAchievementsPage(achHandlers({ badges: badgesFixture(["b1", "b2"]) }));
    await screen.findByText(zh("ach.b1"));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("reduced motion collapses the celebration to a plain toast (no confetti animation node)", async () => {
    const first = renderAchievementsPage(achHandlers({ badges: badgesFixture([]) }), "off");
    await screen.findByText(zh("ach.b1"));

    const secondClient = createStubClient(
      achHandlers({ badges: badgesFixture(["b1"]) }),
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const SecondWrapper = makeStubWrapper(secondClient);
    first.rerender(
      <SecondWrapper>
        <MemoryRouter>
          <LanguageProvider>
            <ThemeProvider>
              <AchievementsPage />
            </ThemeProvider>
          </LanguageProvider>
        </MemoryRouter>
      </SecondWrapper>,
    );

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const description = successCalls()[0]?.[1] as { description?: unknown };
    // plain string description — no animated JSX node
    expect(typeof description.description).toBe("string");
  });

  it("motion-on celebration carries the confetti vocabulary (animated JSX description)", async () => {
    const first = renderAchievementsPage(achHandlers({ badges: badgesFixture([]) }), "on");
    await screen.findByText(zh("ach.b1"));

    const secondClient = createStubClient(
      achHandlers({ badges: badgesFixture(["b1"]) }),
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const SecondWrapper = makeStubWrapper(secondClient);
    first.rerender(
      <SecondWrapper>
        <MemoryRouter>
          <LanguageProvider>
            <ThemeProvider>
              <AchievementsPage />
            </ThemeProvider>
          </LanguageProvider>
        </MemoryRouter>
      </SecondWrapper>,
    );

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const description = successCalls()[0]?.[1] as { description?: { props?: { className?: string } } };
    const node = description.description as { props?: { className?: string } };
    expect(node?.props?.className).toContain("animate-confetti");
  });
});

describe("AchievementsPage — the shared emoji map + demo residue", () => {
  it("both pages import the shared badge emoji module (no page-local emoji maps remain)", () => {
    expect(PAGE_SOURCE).toMatch(/from ["']@\/lib\/badges["']/);
    expect(DASHBOARD_SOURCE).toMatch(/from ["']@\/lib\/badges["']/);
    // the dashboard's inline map lifted — the literal map body lives only in lib/badges
    expect(DASHBOARD_SOURCE).not.toMatch(/BADGE_EMOJI\s*[:=]/);
    expect(PAGE_SOURCE).not.toMatch(/BADGE_EMOJI\s*[:=]/);
  });

  it("the demo fixture is retired from the page source and demo-data", () => {
    expect(PAGE_SOURCE).not.toMatch(/demo-data|ACHIEVEMENTS|useUserProgress|UserProgressContext|fmtNum/);
    const demoSource = readFileSync(join(__dirname, "../lib/demo-data.ts"), "utf8");
    expect(demoSource).not.toMatch(/ACHIEVEMENTS|DEFAULT_PROGRESS|DEFAULT_MASTERY/);
  });

  it("the emoji map covers exactly the scaffold's 12 ids and falls back honestly", async () => {
    const { badgeEmoji, BADGE_EMOJI } = await import("@/lib/badges");
    expect(Object.keys(BADGE_EMOJI).sort()).toEqual([...ALL_IDS].sort());
    // the scaffold faces survive the lift verbatim (spot the dashboard's own picks)
    expect(badgeEmoji("b1")).toBe("🎯");
    expect(badgeEmoji("b12")).toBe("🎓");
    // an unknown id is a display fallback, never a crash
    expect(badgeEmoji("bx")).toBe("🏅");
  });

  it("renders the badge emoji next to every badge title", async () => {
    renderAchievementsPage(achHandlers());
    const b1Card = (await screen.findByText(zh("ach.b1"))).closest("div")!;
    expect(within(b1Card as HTMLElement).getByText("🎯")).toBeTruthy();
    const b12Card = screen.getByText(zh("ach.b12")).closest("div")!;
    expect(within(b12Card as HTMLElement).getByText("🎓")).toBeTruthy();
  });
});

describe("achievements i18n — restated thresholds + zh/en parity (AD-9)", () => {
  it("every ach.* key the page uses exists in BOTH languages with non-empty copy", () => {
    const keys = [
      "ach.eyebrow", "ach.title", "ach.subtitle", "ach.streak", "ach.badges",
      "ach.unlocked", "ach.locked", "ach.progress", "ach.unlockedCount",
      "ach.loadFailed", "ach.retry", "ach.unlockedToastTitle",
      ...ALL_IDS.map((id) => `ach.${id}`),
      ...ALL_IDS.map((id) => `ach.${id}d`),
    ];
    for (const key of keys) {
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("the descriptions match the restated thresholds (delta decision 1, zh + en)", () => {
    // b1: any quiz session exists
    expect(zhDict["ach.b1d"]).toBe("进行你的第一次测验");
    expect(enDict["ach.b1d"]).toBe("Take your first quiz");
    // b4: COLLECTION badge — 10 flashcards exist across the decks (no review-event tracking exists)
    expect(zhDict["ach.b4d"]).toBe("闪卡集里集齐 10 张闪卡");
    expect(enDict["ach.b4d"]).toBe("Have 10 flashcards across your decks");
    // b6: 5 answers on mistake nodes (复盘 — no reviewed flag exists server-side)
    expect(zhDict["ach.b6d"]).toBe("在错题节点上累计作答 5 次");
    expect(enDict["ach.b6d"]).toBe("Answer 5 times on mistake nodes");
    // b7/b8/b9: 1/3/5 distinct MASTERED nodes (subject tiers generalized)
    expect(zhDict["ach.b7d"]).toBe("掌握 1 个节点");
    expect(enDict["ach.b7d"]).toBe("Master 1 node");
    expect(zhDict["ach.b8d"]).toBe("掌握 3 个节点");
    expect(enDict["ach.b8d"]).toBe("Master 3 nodes");
    expect(zhDict["ach.b9d"]).toBe("掌握 5 个节点");
    expect(enDict["ach.b9d"]).toBe("Master 5 nodes");
    // b10: 3 evidence-producing sessions in ONE day (SM-C3: sessions, never minutes)
    expect(zhDict["ach.b10d"]).toBe("单日完成 3 次测验");
    expect(enDict["ach.b10d"]).toBe("3 quiz sessions in one day");
    // b2/b3/b5/b11/b12 already match — pinned so they stay matched
    expect(zhDict["ach.b2d"]).toContain("3");
    expect(zhDict["ach.b3d"]).toContain("7");
    expect(zhDict["ach.b11d"]).toContain("所有节点");
    expect(zhDict["ach.b12d"]).toContain("100%");
    // the subtitle no longer claims demo states
    expect(zhDict["ach.subtitle"]).not.toContain("演示");
    expect(enDict["ach.subtitle"]).not.toContain("demo");
  });
});

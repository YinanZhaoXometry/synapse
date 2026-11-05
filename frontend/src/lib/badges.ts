/**
 * Badge display metadata + the session-once unlock celebration (FR-28, epic
 * P2-09 T6). The emoji faces are DISPLAY-ONLY metadata of the scaffold's
 * 12-badge taxonomy — unlock state always comes from the server's badgeState
 * read (AD-14: rendering reads, never recomputes); the zh/en name strings
 * live in the i18n dictionary's ach.b* keys.
 *
 * The celebration half is deliberately HONEST v1: no server unlock-moment
 * table exists (T1 computes badge state on read), so a persistent once-ever
 * surface is out of scope. The tracker keeps a SESSION-scoped seen-set in
 * module memory — the first badgeState read of the session is the baseline
 * (already-unlocked badges never celebrate); any badge that transitions
 * locked→unlocked on a later read in the same session is celebrated once.
 * A reload re-baselines silently (documented semantics, not an oversight).
 */

/** The id → emoji face of the scaffold's 12-badge taxonomy (b1..b12). */
export const BADGE_EMOJI: Record<string, string> = {
  b1: "🎯", b2: "🔥", b3: "🔥", b4: "🃏", b5: "💯", b6: "🧭",
  b7: "🧱", b8: "🔍", b9: "🧪", b10: "⏳", b11: "🌿", b12: "🎓",
};

/** The badge's emoji face — an unknown id falls back to the generic medal
 * (a display concern; never a crash). */
export function badgeEmoji(id: string): string {
  return BADGE_EMOJI[id] ?? "🏅";
}

/** The scaffold taxonomy's order (b1..b12) — the grid renders in taxonomy
 * order regardless of the wire's row order (a rendering concern). */
export const BADGE_ORDER: string[] = Array.from({ length: 12 }, (_, i) => `b${i + 1}`);

/** Sort badge rows into the scaffold's taxonomy order; unknown ids trail. */
export function sortBadges<T extends { id: string }>(badges: T[]): T[] {
  return [...badges].sort((a, b) => {
    const ia = BADGE_ORDER.indexOf(a.id);
    const ib = BADGE_ORDER.indexOf(b.id);
    return (ia === -1 ? BADGE_ORDER.length : ia) - (ib === -1 ? BADGE_ORDER.length : ib);
  });
}

// The session-scoped seen-set (module memory — survives route unmounts, dies
// with the page load). `null` = the session has no baseline yet.
let sessionSeenUnlocked: Set<string> | null = null;

/**
 * Diff the current badgeState against the session's seen-set. The FIRST call
 * of a session is the baseline snapshot: it records what is already unlocked
 * and celebrates nothing. Every later call returns the ids that JUST
 * transitioned locked→unlocked (each celebrated exactly once — it is added
 * to the seen-set on return).
 */
export function collectNewUnlocks(badges: Array<{ id: string; unlocked: boolean }>): string[] {
  if (!sessionSeenUnlocked) {
    sessionSeenUnlocked = new Set(badges.filter((badge) => badge.unlocked).map((badge) => badge.id));
    return [];
  }
  const fresh: string[] = [];
  for (const badge of badges) {
    if (badge.unlocked && !sessionSeenUnlocked.has(badge.id)) {
      sessionSeenUnlocked.add(badge.id);
      fresh.push(badge.id);
    }
  }
  return fresh;
}

/**
 * Reset the session's celebration state (the test seam — each test starts a
 * fresh session; production never calls this: a page load IS a new session).
 */
export function resetBadgeCelebrations(): void {
  sessionSeenUnlocked = null;
}

/**
 * Evidence-day streak (FR-25 / SM-C3): consecutive calendar days with at least
 * one EvidenceRecord — never minutes, never logins. Domain owns this rollup
 * like every other evidence-derived number (AD-6). Pure; "now" is injected.
 */
import type { EvidenceRecord } from "./entities";

/**
 * Which calendar renders a record's day key. "local" is the Phase-1 behavior
 * (the browser's own calendar day); "utc" pins the UTC calendar day — the
 * golden-vector contract (AD-14) and the Ruby port's policy (ADR-0001,
 * amended 2026-11-04), because a server cannot know a browser's local time.
 */
export type DayBoundary = "local" | "utc";

/** Calendar-day key (date only — record times within a day are one day). */
function dayKey(iso: string, boundary: DayBoundary): string {
  const d = new Date(iso);
  if (boundary === "utc") return d.toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface StreakOptions {
  /**
   * Defaults to "local" — Phase-1 behavior, unchanged. The golden vectors
   * (backend/spec/fixtures/mastery_vectors.json, AD-14) generate with "utc".
   */
  dayBoundary?: DayBoundary;
}

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Length of the run of consecutive evidence days ending at the latest evidence
 * day. The streak is alive while that day is today or yesterday (a day isn't
 * over until it's over); otherwise broken → 0.
 */
export function computeStreak(
  records: EvidenceRecord[],
  now: Date = new Date(),
  options: StreakOptions = {},
): number {
  if (records.length === 0) return 0;
  const boundary = options.dayBoundary ?? "local";

  const todayKey = dayKey(now.toISOString(), boundary);
  const daySet = new Set(records.map((r) => dayKey(r.createdAt, boundary)));

  const latest = [...daySet].sort().at(-1)!;
  if (daysBetween(latest, todayKey) > 1) return 0; // last evidence before yesterday

  let streak = 1;
  let cursor = latest;
  while (daySet.has(previousDay(cursor))) {
    cursor = previousDay(cursor);
    streak += 1;
  }
  return streak;
}

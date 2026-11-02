/**
 * Evidence-day streak (FR-25 / SM-C3): consecutive calendar days with at least
 * one EvidenceRecord — never minutes, never logins. Domain owns this rollup
 * like every other evidence-derived number (AD-6). Pure; "now" is injected.
 */
import type { EvidenceRecord } from "./entities";

/** Local calendar-day key (date only — record times within a day are one day). */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
export function computeStreak(records: EvidenceRecord[], now: Date = new Date()): number {
  if (records.length === 0) return 0;

  const todayKey = dayKey(now.toISOString());
  const daySet = new Set(records.map((r) => dayKey(r.createdAt)));

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

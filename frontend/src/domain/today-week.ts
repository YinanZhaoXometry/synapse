/**
 * The 今日学习 week-strip mapping (FR-27, epic P2-09 T3): the api's read
 * model has NO per-day evidence calendar — `analyticsSeries.consistency`
 * (the last 14 UTC days including today, zeros included, distinct
 * evidence-producing sessions per day — SM-C3) is the honest source, and
 * this module maps it onto the current Mon–Sun UTC week. Day keys follow
 * Mastery's utc_day_key convention ("YYYY-MM-DD", UTC; the streak's
 * boundary, ADR-0001); weeks are ISO Monday-UTC, the same boundary the
 * backend's week windows use. A day the series does not name is outside the
 * 14-day window (the week's future days — Monday sits at most 6 days back,
 * so every past day of the current week is always covered) and renders as
 * no-data. The strip never invents evidence.
 */
import type { ConsistencyDayView } from "@/api/queries/hub-queries";

/** The UTC day key of a Date — Mastery's utc_day_key convention. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface WeekStripCell {
  /** The UTC day key ("YYYY-MM-DD"). */
  day: string;
  /** The i18n key of the weekday name (Mon-first). */
  labelKey: string;
  /** evidence = sessions that day · quiet = inside the consistency window,
   * zero sessions · unknown = outside the 14-day window (no data — honest). */
  state: "evidence" | "quiet" | "unknown";
  sessions: number;
}

const WEEKDAY_KEYS = [
  "planner.weekdayMon",
  "planner.weekdayTue",
  "planner.weekdayWed",
  "planner.weekdayThu",
  "planner.weekdayFri",
  "planner.weekdaySat",
  "planner.weekdaySun",
] as const;

/** Map the consistency series onto the current Mon–Sun UTC week, `todayKey`
 * injected so callers (and specs) pin the clock. */
export function todayWeekStrip(consistency: ConsistencyDayView[], todayKey: string): WeekStripCell[] {
  const today = new Date(`${todayKey}T00:00:00Z`);
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((today.getUTCDay() + 6) % 7)); // back to Mon
  const byDay = new Map(consistency.map((entry) => [entry.day, entry.sessionCount]));
  return Array.from({ length: 7 }, (_, index) => {
    const cell = new Date(monday);
    cell.setUTCDate(cell.getUTCDate() + index);
    const key = utcDayKey(cell);
    const sessions = byDay.get(key);
    return {
      day: key,
      labelKey: WEEKDAY_KEYS[index],
      state: sessions === undefined ? "unknown" : sessions > 0 ? "evidence" : "quiet",
      sessions: sessions ?? 0,
    };
  });
}

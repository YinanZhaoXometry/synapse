/**
 * The week-strip mapping's domain tests (epic P2-09 T3, AD-10): the
 * consistency→week mapping is pure — the clock is injected as the UTC day
 * key, so every edge is deterministic (Mon-first columns, evidence vs quiet
 * vs the honest no-data bucket, zero sessions counted as a quiet day, and
 * the series' absence never inventing evidence).
 */
import { describe, expect, it } from "vitest";
import { todayWeekStrip, utcDayKey } from "./today-week";

/** A WEDNESDAY anchor (2026-11-04): Monday is two days back, so Mon+Tue of
 * the current week sit inside the consistency window's past days. */
const TODAY = "2026-11-04";
const dayAt = (offsetFromMonday: number) => {
  const d = new Date("2026-11-02T00:00:00Z"); // that week's Monday
  d.setUTCDate(d.getUTCDate() + offsetFromMonday);
  return utcDayKey(d);
};

describe("todayWeekStrip — the consistency→week mapping (FR-27)", () => {
  it("lays out Mon–Sun UTC with Mon-first columns and the streak's day-key convention", () => {
    const strip = todayWeekStrip([], TODAY);

    expect(strip).toHaveLength(7);
    expect(strip[0].day).toBe("2026-11-02"); // Monday
    expect(strip[3].day).toBe("2026-11-05"); // Thursday
    expect(strip[6].day).toBe("2026-11-08"); // Sunday
    expect(strip[6].labelKey).toBe("planner.weekdaySun");
    expect(strip[0].labelKey).toBe("planner.weekdayMon");
  });

  it("classifies named days: sessions → evidence, zero sessions → quiet (a quiet day is still a day)", () => {
    const strip = todayWeekStrip(
      [
        { day: dayAt(0), sessionCount: 3 },
        { day: dayAt(1), sessionCount: 0 },
      ],
      TODAY,
    );

    expect(strip[0].state).toBe("evidence");
    expect(strip[0].sessions).toBe(3);
    expect(strip[1].state).toBe("quiet");
    expect(strip[1].sessions).toBe(0);
  });

  it("renders unnamed days as no-data — the series' absence never invents evidence", () => {
    const strip = todayWeekStrip([], TODAY);
    expect(strip.every((cell) => cell.state === "unknown" && cell.sessions === 0)).toBe(true);
  });

  it("keeps the week's future days in the unknown bucket (outside the 14-day window)", () => {
    // Wednesday today: Wed..Sun are the week's future — the consistency
    // series (the last 14 days including today) cannot have named them.
    const strip = todayWeekStrip(
      [
        { day: dayAt(0), sessionCount: 1 },
        { day: dayAt(1), sessionCount: 2 },
        { day: dayAt(2), sessionCount: 1 },
      ],
      TODAY,
    );

    expect(strip.slice(0, 3).every((cell) => cell.state === "evidence")).toBe(true);
    expect(strip.slice(3).every((cell) => cell.state === "unknown")).toBe(true);
  });
});

describe("utcDayKey — Mastery's utc_day_key convention", () => {
  it("renders a Date as its UTC day regardless of the local zone", () => {
    expect(utcDayKey(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-04");
    expect(utcDayKey(new Date("2026-11-05T00:00:00Z"))).toBe("2026-11-05");
  });
});

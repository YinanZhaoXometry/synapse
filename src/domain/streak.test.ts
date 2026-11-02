import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "./entities";
import { computeStreak } from "./streak";

let seq = 0;
function ev(createdAt: string): EvidenceRecord {
  seq += 1;
  return { id: `ev-${seq}`, nodeId: "n1", sessionId: null, questionId: null, outcome: "correct", createdAt };
}

// "now" is injected — the streak must be deterministic for tests and demos.
const NOW = new Date("2026-11-05T21:00:00");

function dayAt(dayOfMonth: number): string {
  return `2026-11-${String(dayOfMonth).padStart(2, "0")}T12:00:00`;
}

describe("evidence-day streak (FR-25: consecutive days with ≥1 evidence-producing session)", () => {
  it("no evidence → streak 0", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts consecutive evidence days ending today", () => {
    const records = [dayAt(3), dayAt(4), dayAt(5)].map(ev); // 3rd, 4th, 5th = today
    expect(computeStreak(records, NOW)).toBe(3);
  });

  it("a gap breaks the streak — only the current run counts", () => {
    const records = [dayAt(1), dayAt(2), dayAt(3), dayAt(5)].map(ev); // gap on the 4th
    expect(computeStreak(records, NOW)).toBe(1);
  });

  it("latest evidence two days ago → the streak is broken", () => {
    const records = [dayAt(1), dayAt(2), dayAt(3)].map(ev); // nothing on the 4th or 5th
    expect(computeStreak(records, NOW)).toBe(0);
  });

  it("evidence yesterday (not yet today) keeps the streak alive", () => {
    const records = [dayAt(4)].map(ev);
    expect(computeStreak(records, NOW)).toBe(1);
  });

  it("multiple records on one day count as one evidence day", () => {
    const records = [
      "2026-11-05T08:00:00",
      "2026-11-05T12:00:00",
      "2026-11-05T20:00:00",
    ].map(ev);
    expect(computeStreak(records, NOW)).toBe(1);
  });

  it("older runs behind a gap never add to the streak", () => {
    const records = [dayAt(1), dayAt(2), dayAt(3), dayAt(4), dayAt(5)].map(ev);
    expect(computeStreak(records, NOW)).toBe(5);
    expect(computeStreak([...records, ev("2026-10-20T12:00:00")], NOW)).toBe(5);
  });

  it("non-evidence activity (logins, minutes, ratings) never counts — only EvidenceRecords do", () => {
    // Yesterday's evidence: streak alive at 1.
    const yesterdayOnly = [dayAt(4)].map(ev);
    expect(computeStreak(yesterdayOnly, NOW)).toBe(1);

    // "Activity" today that produces no EvidenceRecord (a login, minutes read,
    // a flashcard self-rating — none of these are EvidenceRecords) cannot
    // extend the streak: the signature accepts only records, so the run stays 1.
    expect(computeStreak(yesterdayOnly, NOW)).toBe(1);
    expect(computeStreak([], NOW)).toBe(0); // all the logins in the world → no evidence → 0
  });
});

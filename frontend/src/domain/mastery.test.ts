import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "./entities";
import {
  MASTERY_CONFIG,
  computeNodeScore,
  computePlanRollup,
  computeTaskRollup,
  getNodeState,
  summarizeNodes,
} from "./mastery";

// Fixture builder — records carry ISO timestamps; the window must honor them.
let seq = 0;
function ev(outcome: EvidenceRecord["outcome"], createdAt: string): EvidenceRecord {
  seq += 1;
  return { id: `ev-${seq}`, nodeId: "n1", sessionId: null, questionId: null, outcome, createdAt };
}

describe("node score (ADR-0001 windowed mean)", () => {
  it("an uncovered node scores 0 and reads uncovered — never green", () => {
    expect(computeNodeScore([])).toBe(0);
    expect(getNodeState([])).toBe("uncovered");
  });

  it("one lucky correct answer caps at 99 — below the gate it can never read 100", () => {
    const records = [ev("correct", "2026-11-01T10:00:00Z")];
    expect(computeNodeScore(records)).toBe(99); // score-level gate cap (ADR-0001 amendment)
    expect(getNodeState(records)).toBe("partial"); // gate: needs ≥3 evidence
  });

  it("outcomes average over the window: correct+partial+wrong → 50", () => {
    const records = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("partial", "2026-11-01T11:00:00Z"),
      ev("wrong", "2026-11-01T12:00:00Z"),
    ];
    expect(computeNodeScore(records)).toBe(50);
    expect(getNodeState(records)).toBe("partial");
  });

  it("early wrong answers age out: wrong + five corrects → 100 mastered", () => {
    const records = [
      ev("wrong", "2026-11-01T10:00:00Z"),
      ...[1, 2, 3, 4, 5].map((i) => ev("correct", `2026-11-0${i + 1}T10:00:00Z`)),
    ];
    expect(computeNodeScore(records)).toBe(100);
    expect(getNodeState(records)).toBe("mastered");
  });

  it("the window follows createdAt, not array order", () => {
    const records = [
      ev("correct", "2026-11-05T10:00:00Z"), // newest
      ev("correct", "2026-11-01T10:00:00Z"), // oldest
      ev("wrong", "2026-11-03T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("correct", "2026-11-04T10:00:00Z"),
    ];
    // five records: sorted newest-first = correct,correct,correct,wrong,correct → 80
    expect(computeNodeScore(records)).toBe(80);
  });
});

describe("mastered gate (ADR-0001 anti-inflation)", () => {
  it("two corrects cap at 99 and stay partial — the gate counts total evidence", () => {
    const records = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
    ];
    expect(computeNodeScore(records)).toBe(99);
    expect(getNodeState(records)).toBe("partial");
  });

  it("three corrects master the node", () => {
    const records = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    expect(getNodeState(records)).toBe("mastered");
  });

  it("score 80 with the gate met masters; below the threshold stays partial", () => {
    const at80 = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("correct", "2026-11-03T10:00:00Z"),
      ev("correct", "2026-11-04T10:00:00Z"),
      ev("wrong", "2026-11-05T10:00:00Z"),
    ];
    expect(computeNodeScore(at80)).toBe(80);
    expect(getNodeState(at80)).toBe("mastered");

    const below = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("correct", "2026-11-03T10:00:00Z"),
      ev("wrong", "2026-11-04T10:00:00Z"),
      ev("wrong", "2026-11-05T10:00:00Z"),
    ];
    expect(getNodeState(below)).toBe("partial"); // 60
  });

  it("partial credit counts half: c+c+partial → 83 (rounded), mastered", () => {
    const records = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("partial", "2026-11-03T10:00:00Z"),
    ];
    expect(computeNodeScore(records)).toBe(83); // 2.5/3 → 83.33 → 83
    expect(getNodeState(records)).toBe("mastered");
  });

  it("evidence of only wrong answers reads partial, never uncovered", () => {
    const records = [1, 2, 3].map((i) => ev("wrong", `2026-11-0${i}T10:00:00Z`));
    expect(computeNodeScore(records)).toBe(0);
    expect(getNodeState(records)).toBe("partial"); // evidence exists — just bad
  });

  it("a forfeit records as wrong evidence — no mastery credit", () => {
    const forfeitAsWrong = [
      ev("wrong", "2026-11-01T10:00:00Z"), // the forfeited question
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("correct", "2026-11-03T10:00:00Z"),
      ev("correct", "2026-11-04T10:00:00Z"),
    ];
    // window: c,c,c,w → 75 → partial; the forfeit drags the score down
    expect(computeNodeScore(forfeitAsWrong)).toBe(75);
    expect(getNodeState(forfeitAsWrong)).toBe("partial");
  });
});

describe("rollups (AD-6: domain owns every evidence-derived rollup)", () => {
  it("plan rollup = mean of node scores, uncovered nodes counting 0", () => {
    const mastered = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    const half = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("partial", "2026-11-02T10:00:00Z"),
      ev("wrong", "2026-11-03T10:00:00Z"),
    ];
    const rollup = computePlanRollup({
      masteredNode: mastered,
      halfNode: half,
      untouchedNode: [],
    });
    expect(rollup).toBe(50); // (100 + 50 + 0) / 3
  });

  it("rollup reaches 100 only when EVERY node is mastered (readiness contract)", () => {
    const good = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    expect(computePlanRollup({ a: good, b: [...good], c: [...good] })).toBe(100);
    // ADR-0001 amendment 2026-11-04: the rollup mean FLOORS, so (100+100+0)/3 =
    // 66.67 → 66 (half-up used to round it to 67). One uncovered node now holds
    // the plan strictly below the mastereds' mean as well as below 100.
    expect(computePlanRollup({ a: good, b: [...good], c: [] })).toBe(66);
  });

  it("a single unverified 99-node holds the plan below 100 (floored tie, ADR-0001 amendment 2026-11-04)", () => {
    const good = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    const perfectUnverified = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
    ]; // gate unmet → capped 99, partial
    // (100 + 99) / 2 = 99.5 — half-up rounded the tie UP to 100 (the golden
    // vectors' flagged finding, ticket 01); the floored rollup keeps it at 99,
    // restoring "100% only when every node is mastered".
    expect(getNodeState(perfectUnverified)).toBe("partial");
    expect(computePlanRollup({ a: good, b: perfectUnverified })).toBe(99);
  });

  it("rollup floors the mean of node scores (one rounding, once)", () => {
    const good = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    const half = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("partial", "2026-11-02T10:00:00Z"),
      ev("wrong", "2026-11-03T10:00:00Z"),
    ];
    // (100 + 100 + 50) / 3 = 83.33 → 83 (identical under half-up and floor)
    expect(computePlanRollup({ a: good, b: [...good], c: half })).toBe(83);
  });

  it("a Study Task's rollup is exactly its single node's score (no other rollup exists)", () => {
    const records = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
      ev("partial", "2026-11-03T10:00:00Z"),
    ];
    expect(computeTaskRollup(records)).toBe(83);
    expect(computeTaskRollup([])).toBe(0);
  });

  it("summarizeNodes returns the per-node surface contract (score + state)", () => {
    const good = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    const summary = summarizeNodes({ strong: good, weak: [] });
    expect(summary).toEqual([
      { nodeId: "strong", score: 100, state: "mastered" },
      { nodeId: "weak", score: 0, state: "uncovered" },
    ]);
  });
});

describe("freshness cap (ADR-0001 amendment 2026-11-04, epic P2-4 ticket 04)", () => {
  // Hand-worked boundary instants: latest evidence 2026-11-05T10:00:00Z;
  // freshnessDays 14 ⇒ fresh through 2026-11-19T10:00:00Z, stale one second later.
  const threeCorrect = [
    ev("correct", "2026-11-03T10:00:00Z"),
    ev("correct", "2026-11-04T10:00:00Z"),
    ev("correct", "2026-11-05T10:00:00Z"),
  ];

  it("latest evidence exactly 14 days old is fresh — the node certifies 100/mastered", () => {
    const now = "2026-11-19T10:00:00Z"; // exactly freshnessDays after the newest record
    expect(MASTERY_CONFIG.freshnessDays).toBe(14);
    expect(computeNodeScore(threeCorrect, now)).toBe(100);
    expect(getNodeState(threeCorrect, now)).toBe("mastered");
  });

  it("latest evidence 14 days + 1 second old is stale — capped 99, never mastered", () => {
    const now = "2026-11-19T10:00:01Z";
    expect(computeNodeScore(threeCorrect, now)).toBe(99);
    expect(getNodeState(threeCorrect, now)).toBe("partial");
  });

  it("a mastered node decaying drops to partial: full-window 100 → capped 99", () => {
    const mastered = [1, 2, 3, 4, 5].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    expect(getNodeState(mastered, "2026-11-19T10:00:00Z")).toBe("mastered");
    expect(computeNodeScore(mastered, "2026-11-19T10:00:01Z")).toBe(99);
    expect(getNodeState(mastered, "2026-11-19T10:00:01Z")).toBe("partial");
  });

  it("the cap never drifts a sub-99 score downward: stale 83 stays 83 (only the seal expires)", () => {
    const eightyThree = [
      ev("correct", "2026-11-03T10:00:00Z"),
      ev("correct", "2026-11-04T10:00:00Z"),
      ev("partial", "2026-11-05T10:00:00Z"),
    ]; // 2.5/3 → 83.33 → 83
    expect(computeNodeScore(eightyThree, "2026-11-19T10:00:00Z")).toBe(83);
    expect(getNodeState(eightyThree, "2026-11-19T10:00:00Z")).toBe("mastered");
    expect(computeNodeScore(eightyThree, "2026-11-19T10:00:01Z")).toBe(83);
    expect(getNodeState(eightyThree, "2026-11-19T10:00:01Z")).toBe("partial");
  });

  it("freshness judges the LATEST record, not the oldest: a fresh recent answer renews the node", () => {
    const staleThenFresh = [
      ev("correct", "2026-10-01T10:00:00Z"), // 49 days old — would be stale alone
      ev("correct", "2026-11-18T10:00:00Z"), // 1 day before now — the latest record
      ev("correct", "2026-11-19T09:00:00Z"),
    ];
    expect(computeNodeScore(staleThenFresh, "2026-11-19T10:00:00Z")).toBe(100);
    expect(getNodeState(staleThenFresh, "2026-11-19T10:00:00Z")).toBe("mastered");
  });

  it("the plan rollup holds below 100 when one node has decayed (a decayed node can never certify)", () => {
    const fresh = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i + 5}T10:00:00Z`)); // Nov 6–8, fresh
    const decayed = [1, 2, 3].map((i) => ev("correct", `2026-10-2${i - 1}T10:00:00Z`)); // Oct 21–23, stale
    const now = "2026-11-19T10:00:01Z";
    expect(getNodeState(fresh, now)).toBe("mastered");
    expect(getNodeState(decayed, now)).toBe("partial");
    // floor((100 + 99) / 2) = 99 — freshness caps the decayed node at 99, same as the gate cap.
    expect(computePlanRollup({ fresh, decayed }, now)).toBe(99);
  });

  it("the gate cap and the freshness cap compose as the max of two 'at most 99' caps", () => {
    const twoCorrect = [ev("correct", "2026-10-21T10:00:00Z"), ev("correct", "2026-10-22T10:00:00Z")];
    const now = "2026-11-19T10:00:01Z"; // gate unmet (2 < 3) AND stale
    expect(computeNodeScore(twoCorrect, now)).toBe(99);
    expect(getNodeState(twoCorrect, now)).toBe("partial");
  });

  it("without an injected now the read is the Phase-1 one — no freshness, timestamps ignored", () => {
    // The default posture (mirrors computeStreak's dayBoundary default): surfaces
    // that don't inject now keep the identical pre-amendment behavior.
    expect(computeNodeScore(threeCorrect)).toBe(100);
    expect(getNodeState(threeCorrect)).toBe("mastered");
  });

  it("the rollups and the per-node summary pass freshness through unchanged", () => {
    const now = "2026-11-19T10:00:01Z";
    const fresh = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i + 5}T10:00:00Z`));
    const decayed = [1, 2, 3].map((i) => ev("correct", `2026-10-2${i - 1}T10:00:00Z`));
    expect(summarizeNodes({ fresh, decayed }, now)).toEqual([
      { nodeId: "fresh", score: 100, state: "mastered" },
      { nodeId: "decayed", score: 99, state: "partial" },
    ]);
    expect(computeTaskRollup(decayed, now)).toBe(99); // a task's node decays with it
  });
});

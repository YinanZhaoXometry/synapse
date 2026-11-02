import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "./entities";
import { computeNodeScore, computePlanRollup, computeTaskRollup, getNodeState, summarizeNodes } from "./mastery";

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

  it("one lucky correct answer scores 100 but does NOT master the node", () => {
    const records = [ev("correct", "2026-11-01T10:00:00Z")];
    expect(computeNodeScore(records)).toBe(100);
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
  it("two corrects score 100 but stay partial — the gate counts total evidence", () => {
    const records = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("correct", "2026-11-02T10:00:00Z"),
    ];
    expect(computeNodeScore(records)).toBe(100);
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
    expect(computePlanRollup({ a: good, b: [...good], c: [] })).toBe(67); // one uncovered caps it
  });

  it("rollup rounds the mean of node scores", () => {
    const good = [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
    const half = [
      ev("correct", "2026-11-01T10:00:00Z"),
      ev("partial", "2026-11-02T10:00:00Z"),
      ev("wrong", "2026-11-03T10:00:00Z"),
    ];
    // (100 + 100 + 50) / 3 = 83.33 → 83
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

import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeNode } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { taskMasteryView, taskOwnEvidence } from "./display-shaping";

/**
 * Task Home display shaping (T2; spec testing seam 2 — pure display-shaping):
 * evidence → presentation inputs, with the numbers asserted as the exact
 * ADR-0001 worked examples (window 5, cap-99 below the 3-evidence gate,
 * mastered = ≥80 & ≥3). The expected values are read from the shipped domain
 * tests (mastery.test.ts) — an independent source — never recomputed here.
 */

let seq = 0;
const ev = (nodeId: string, outcome: EvidenceRecord["outcome"], createdAt: string): EvidenceRecord => {
  seq += 1;
  return { id: `ev-${seq}`, nodeId, sessionId: null, questionId: null, outcome, createdAt };
};

const taskNode = (id: string): KnowledgeNode => ({
  id,
  planId: null,
  taskId: "t1",
  stage: null,
  title: "lecture-04",
  order: 0,
});

describe("task mastery view (AD-6/ADR-0001: the single owned node's score)", () => {
  it("no evidence reads honestly uncovered: score 0, no marks, not below the gate", () => {
    const view = taskMasteryView(taskNode("n1"), []);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("one correct caps at 99 below the gate and stays partial — 100 must mean verified mastery", () => {
    const view = taskMasteryView(taskNode("n1"), [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view.score).toBe(99); // score-level gate cap (ADR-0001 amendment)
    expect(view.state).toBe("partial"); // gate: needs ≥3 records
    expect(view.hasEvidence).toBe(true);
    expect(view.belowGate).toBe(true); // the popover names the cap
    expect(view.lastOutcomes).toEqual(["correct"]);
  });

  it("correct+correct+partial → 83 and mastered — the mastery.test.ts worked example", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(83); // 2.5/3 → 83.33 → 83, gate met, ≥80 → mastered
    expect(view.state).toBe("mastered");
    expect(view.belowGate).toBe(false);
  });

  it("the window is 5: an early wrong ages out of both the score and the marks", () => {
    const records = [
      ev("n1", "wrong", "2026-11-01T10:00:00Z"),
      ...[2, 3, 4, 5, 6].map((d) => ev("n1", "correct", `2026-11-0${d}T10:00:00Z`)),
    ];
    const view = taskMasteryView(taskNode("n1"), records);
    expect(view.score).toBe(100); // mean of the last 5 = all correct → 100, gate met
    expect(view.state).toBe("mastered");
    expect(view.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "correct"]); // oldest → newest
    expect(view.lastOutcomes).toHaveLength(MASTERY_CONFIG.window);
    expect(view.lastOutcomes).not.toContain("wrong"); // the dropped record stays out of the marks
  });

  it("two corrects: 99 partial with the cap note, marks oldest → newest", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
    ]);
    expect(view.score).toBe(99);
    expect(view.state).toBe("partial");
    expect(view.belowGate).toBe(true);
    expect(view.lastOutcomes).toEqual(["correct", "correct"]); // createdAt order, not array order
  });

  it("evidence never bleeds across nodes (AD-6): other nodes' records are invisible to the task", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("other-node", "correct", "2026-11-01T10:00:00Z"),
      ev("other-node", "correct", "2026-11-02T10:00:00Z"),
      ev("other-node", "correct", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(0);
    expect(view.state).toBe("uncovered");
    expect(view.hasEvidence).toBe(false);
  });

  it("a missing node (bad task id) shapes to the honest uncovered zero", () => {
    expect(taskOwnEvidence(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")])).toEqual([]);
    const view = taskMasteryView(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("taskOwnEvidence keeps only the task node's own records", () => {
    const records = [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n2", "wrong", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ];
    expect(taskOwnEvidence(taskNode("n1"), records)).toEqual([records[0], records[2]]);
  });
});

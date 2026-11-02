import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeNode, StudyPlan } from "@/domain/entities";
import {
  evidenceStreak,
  masteryRingVariant,
  mostRecentPlan,
  nodeRowViews,
  planCardMetrics,
  planRecentActivity,
  stageGroups,
} from "./display-shaping";

const plan = (id: string, createdAt: string): StudyPlan => ({
  id,
  topic: `topic-${id}`,
  goal: null,
  nodeIds: [],
  materialIds: [],
  createdAt,
});

const node = (id: string): KnowledgeNode => ({
  id,
  planId: "p1",
  taskId: null,
  stage: "基础",
  title: `node-${id}`,
  order: 0,
});

const nodeIn = (id: string, stage: string | null, order: number): KnowledgeNode => ({
  ...node(id),
  stage,
  order,
  title: `node-${id}`,
});

/** Evidence fixture: `n` correct records on one node (3+ → mastered per ADR-0001 gate). */
const evidence = (nodeId: string, correctCount: number): EvidenceRecord[] =>
  Array.from({ length: correctCount }, (_, i) => ({
    id: `${nodeId}-e${i}`,
    nodeId,
    sessionId: null,
    questionId: null,
    outcome: "correct",
    createdAt: `2026-11-01T10:0${i}:00Z`,
  }));

describe("display shaping (spec seam 4: evidence → presentation inputs)", () => {
  it("most-recent-plan selection: the latest createdAt wins regardless of list order", () => {
    const plans = [plan("a", "2026-11-01T10:00:00Z"), plan("b", "2026-11-02T09:00:00Z")];
    expect(mostRecentPlan(plans)?.id).toBe("b");
    expect(mostRecentPlan([plans[1], plans[0]])?.id).toBe("b");
  });

  it("most-recent-plan selection: no plans → undefined (the empty state owns the page)", () => {
    expect(mostRecentPlan([])).toBeUndefined();
  });

  it("mastery ring variant (FR-3 display contract): exactly 100 renders as the readiness state, anything under stays brand", () => {
    expect(masteryRingVariant(100)).toBe("mastered");
    expect(masteryRingVariant(99)).toBe("brand");
    expect(masteryRingVariant(0)).toBe("brand");
  });

  it("rollup composition: uncovered nodes count 0 — one mastered node beside two uncovered reads ~33%", () => {
    const nodes = [node("n1"), node("n2"), node("n3")];
    const metrics = planCardMetrics(nodes, evidence("n1", 3));
    expect(metrics.rollup).toBe(33);
    expect(metrics.stateCounts).toEqual({ mastered: 1, partial: 0, uncovered: 2 });
  });

  it("state counts shape the mini bar: partial nodes sit between mastered and uncovered", () => {
    const nodes = [node("n1"), node("n2"), node("n3")];
    // n2 has a single correct record → partial (below the 3-record gate);
    // its score is 99 (un-gated cap), so rollup = round((100 + 99 + 0) / 3) = 66
    const metrics = planCardMetrics(nodes, [...evidence("n1", 3), ...evidence("n2", 1)]);
    expect(metrics.stateCounts).toEqual({ mastered: 1, partial: 1, uncovered: 1 });
    expect(metrics.rollup).toBe(66);
  });
});

describe("plan home shaping (ticket 03): stage grouping + node rows", () => {
  it("stage groups keep first-appearance stage order and node order within a stage", () => {
    const rows = [
      nodeIn("a", "核心", 2),
      nodeIn("b", "基础", 0),
      nodeIn("c", "核心", 3),
      nodeIn("d", "基础", 1),
    ];
    const groups = stageGroups(rows);
    expect(groups.map((g) => g.stage)).toEqual(["核心", "基础"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("a null stage forms its own group in first-appearance position (stageless nodes are honest, not hidden)", () => {
    const rows = [nodeIn("a", null, 0), nodeIn("b", "基础", 1), nodeIn("c", null, 2)];
    const groups = stageGroups(rows);
    expect(groups.map((g) => g.stage)).toEqual([null, "基础"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("node rows: fresh node reads uncovered with score available for the em-dash rule", () => {
    const views = nodeRowViews([node("n1")], []);
    expect(views).toHaveLength(1);
    expect(views[0].state).toBe("uncovered");
    expect(views[0].hasEvidence).toBe(false);
    expect(views[0].lastOutcomes).toEqual([]);
  });

  it("node rows: evidence-backed node carries its domain score/state and the last-5 outcome marks (oldest → newest)", () => {
    // 6 records: score is the mean of the most recent 5 (window), so the
    // displayed marks must be those same 5, in chronological order.
    const records: EvidenceRecord[] = [
      { id: "e0", nodeId: "n1", sessionId: "s1", questionId: "q0", outcome: "wrong", createdAt: "2026-11-01T10:00:00Z" },
      ...["2026-11-01T11:00:00Z", "2026-11-01T12:00:00Z", "2026-11-01T13:00:00Z", "2026-11-01T14:00:00Z"].map(
        (createdAt, i) =>
          ({ id: `e${i + 1}`, nodeId: "n1", sessionId: "s1", questionId: null, outcome: "correct", createdAt } as const),
      ),
      { id: "e5", nodeId: "n1", sessionId: "s1", questionId: "q5", outcome: "partial", createdAt: "2026-11-01T15:00:00Z" },
    ];
    const [view] = nodeRowViews([node("n1")], records);
    // window = the 5 most recent (e1..e4 correct + e5 partial) → mean 0.9 → 90, gate met → mastered
    expect(view.state).toBe("mastered");
    expect(view.score).toBe(90);
    expect(view.hasEvidence).toBe(true);
    expect(view.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "partial"]);
    expect(records.some((r) => r.outcome === "wrong")).toBe(true); // the dropped record stays out of the marks
  });
});

describe("plan home shaping (ticket 03): recent activity", () => {
  const planNodes = [nodeIn("n1", "基础", 0), nodeIn("n2", "核心", 1)];

  it("groups evidence into session-ish entries, drops other plans' records, newest session first", () => {
    const evidence: EvidenceRecord[] = [
      { id: "e-old", nodeId: "n1", sessionId: "s1", questionId: "q1", outcome: "correct", createdAt: "2026-11-01T09:00:00Z" },
      { id: "e-old2", nodeId: "n2", sessionId: "s1", questionId: "q2", outcome: "correct", createdAt: "2026-11-01T09:05:00Z" },
      { id: "e-new", nodeId: "n1", sessionId: "s2", questionId: "q3", outcome: "partial", createdAt: "2026-11-02T10:00:00Z" },
      { id: "e-foreign", nodeId: "zz", sessionId: "s3", questionId: "q4", outcome: "correct", createdAt: "2026-11-02T11:00:00Z" },
    ];
    // the surface passes this plan's own nodes; s3 belongs to another plan's node and must drop
    const entries = planRecentActivity(planNodes, evidence);
    expect(entries.map((e) => e.id)).toEqual(["s2", "s1"]);
    expect(entries[0]).toMatchObject({ nodeTitle: "node-n1", recordCount: 1, latestAt: "2026-11-02T10:00:00Z" });
    expect(entries[1]).toMatchObject({ recordCount: 2 });
  });

  it("entry scores come from the shipped node-score function (no display arithmetic)", () => {
    // s1 = correct + partial → mean 0.75 → 75 (2 records, under the gate, still 75);
    // s2 = 3 correct → gate met → 100.
    const evidence: EvidenceRecord[] = [
      { id: "a", nodeId: "n1", sessionId: "s1", questionId: null, outcome: "correct", createdAt: "2026-11-01T09:00:00Z" },
      { id: "b", nodeId: "n2", sessionId: "s1", questionId: null, outcome: "partial", createdAt: "2026-11-01T09:05:00Z" },
      { id: "c", nodeId: "n1", sessionId: "s2", questionId: null, outcome: "correct", createdAt: "2026-11-02T09:00:00Z" },
      { id: "d", nodeId: "n2", sessionId: "s2", questionId: null, outcome: "correct", createdAt: "2026-11-02T09:01:00Z" },
      { id: "f", nodeId: "n2", sessionId: "s2", questionId: null, outcome: "correct", createdAt: "2026-11-02T09:02:00Z" },
    ];
    const entries = planRecentActivity(planNodes, evidence);
    const byId = new Map(entries.map((e) => [e.id, e]));
    expect(byId.get("s1")?.score).toBe(75);
    expect(byId.get("s2")?.score).toBe(100);
  });

  it("sessionless records each form their own entry; nothing at all → empty shell", () => {
    const evidence: EvidenceRecord[] = [
      { id: "r1", nodeId: "n1", sessionId: null, questionId: null, outcome: "wrong", createdAt: "2026-11-01T08:00:00Z" },
      { id: "r2", nodeId: "n1", sessionId: null, questionId: null, outcome: "correct", createdAt: "2026-11-01T08:30:00Z" },
    ];
    const entries = planRecentActivity(planNodes, evidence);
    expect(entries.map((e) => e.id)).toEqual(["evidence-r2", "evidence-r1"]);
    expect(planRecentActivity(planNodes, [])).toEqual([]);
  });
});

describe("plan home shaping (ticket 03): streak composition", () => {
  it("counts consecutive evidence days ending today/yesterday through the shipped domain streak", () => {
    const now = new Date("2026-11-03T21:00:00");
    const evidence: EvidenceRecord[] = [
      { id: "d1", nodeId: "n1", sessionId: null, questionId: null, outcome: "correct", createdAt: "2026-11-02T10:00:00Z" },
      { id: "d2", nodeId: "n1", sessionId: null, questionId: null, outcome: "wrong", createdAt: "2026-11-03T08:00:00Z" },
      // a day beyond the gap does not extend the run (streak = today + yesterday, not 3)
      { id: "d0", nodeId: "n1", sessionId: null, questionId: null, outcome: "correct", createdAt: "2026-10-31T09:00:00Z" },
    ];
    expect(evidenceStreak(evidence, now)).toBe(2);
    expect(evidenceStreak([], now)).toBe(0);
  });
});

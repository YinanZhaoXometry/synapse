import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeNode, StudyPlan } from "@/domain/entities";
import { mostRecentPlan, planCardMetrics } from "./display-shaping";

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

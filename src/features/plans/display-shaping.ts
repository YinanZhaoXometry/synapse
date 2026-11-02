/**
 * Display shaping (spec testing seam 4; AD-6): evidence → presentation inputs.
 * Thin composition over the shipped domain functions — no mastery arithmetic
 * lives here; shaping only seeds nodes without evidence (uncovered = 0) and
 * picks the continue-hero plan.
 */
import type { EvidenceRecord, KnowledgeNode, NodeState, StudyPlan } from "@/domain/entities";
import { computePlanRollup, getNodeState } from "@/domain/mastery";

/** The continue hero's plan: most recent by createdAt. */
export function mostRecentPlan(plans: StudyPlan[]): StudyPlan | undefined {
  return [...plans].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

/** One card/hero's presentation inputs (rollup chip + node-state mini bar). */
export interface PlanCardMetrics {
  rollup: number;
  stateCounts: Record<NodeState, number>;
}

/**
 * Rollup + state counts for a plan's nodes over flat evidence (AD-6 composition).
 * The composition's one job: every node is seeded into the record — including
 * evidence-less ones — so `computePlanRollup` counts uncovered nodes as 0
 * instead of skipping them (ADR-0001); states come from `getNodeState` as shipped.
 */
export function planCardMetrics(nodes: KnowledgeNode[], evidence: EvidenceRecord[]): PlanCardMetrics {
  const recordsByNode: Record<string, EvidenceRecord[]> = {};
  for (const n of nodes) recordsByNode[n.id] = [];
  for (const record of evidence) {
    if (record.nodeId in recordsByNode) recordsByNode[record.nodeId].push(record);
  }
  const stateCounts: Record<NodeState, number> = { mastered: 0, partial: 0, uncovered: 0 };
  for (const n of nodes) stateCounts[getNodeState(recordsByNode[n.id])] += 1;
  return { rollup: computePlanRollup(recordsByNode), stateCounts };
}

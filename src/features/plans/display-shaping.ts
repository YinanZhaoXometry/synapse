/**
 * Display shaping (spec testing seam 4; AD-6): evidence → presentation inputs.
 * Thin composition over the shipped domain functions — no mastery arithmetic
 * lives here; shaping only seeds nodes without evidence (uncovered = 0) and
 * picks the continue-hero plan.
 */
import type { EvidenceRecord, KnowledgeNode, NodeState, Outcome, StudyPlan } from "@/domain/entities";
import { computeNodeScore, computePlanRollup, getNodeState, MASTERY_CONFIG } from "@/domain/mastery";
import { computeStreak } from "@/domain/streak";

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
  const recordsByNode = evidenceByNodeFor(nodes, evidence);
  const stateCounts: Record<NodeState, number> = { mastered: 0, partial: 0, uncovered: 0 };
  for (const n of nodes) stateCounts[getNodeState(recordsByNode[n.id])] += 1;
  return { rollup: computePlanRollup(recordsByNode), stateCounts };
}

/** Evidence grouped per node id; nodes without evidence are seeded with []. */
export function evidenceByNodeFor(nodes: KnowledgeNode[], evidence: EvidenceRecord[]): Record<string, EvidenceRecord[]> {
  const recordsByNode: Record<string, EvidenceRecord[]> = {};
  for (const n of nodes) recordsByNode[n.id] = [];
  for (const record of evidence) {
    if (record.nodeId in recordsByNode) recordsByNode[record.nodeId].push(record);
  }
  return recordsByNode;
}

/** One Plan-Home node row's presentation inputs (glyph/tint/label + score + evidence marks). */
export interface NodeRowView {
  node: KnowledgeNode;
  /** The node's stage, flattened for stage grouping (null = untitled group). */
  stage: string | null;
  /** Domain score — shown only when hasEvidence (em dash otherwise, UX display contract). */
  score: number;
  state: NodeState;
  hasEvidence: boolean;
  /** The score window's outcome marks, oldest → newest (evidence popover). */
  lastOutcomes: Outcome[];
}

/**
 * Per-node rows over flat evidence (AD-6 composition): scores/states from the
 * shipped domain functions; the marks re-derive the same recency window the
 * score uses (MASTERY_CONFIG.window) so popover and number always agree.
 */
export function nodeRowViews(nodes: KnowledgeNode[], evidence: EvidenceRecord[]): NodeRowView[] {
  const recordsByNode = evidenceByNodeFor(nodes, evidence);
  return nodes.map((node) => {
    const records = recordsByNode[node.id];
    const window = [...records]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MASTERY_CONFIG.window)
      .map((r) => r.outcome);
    return {
      node,
      stage: node.stage,
      score: computeNodeScore(records),
      state: getNodeState(records),
      hasEvidence: records.length > 0,
      lastOutcomes: window.reverse(),
    };
  });
}

/** Stage-grouped rows in first-appearance stage order; node order preserved within a stage. */
export interface StageGroup<T> {
  /** null = the plan draft carried no stage (renders as the untitled group). */
  stage: string | null;
  rows: T[];
}

export function stageGroups<T extends { stage: string | null }>(rows: T[]): StageGroup<T>[] {
  const groups: StageGroup<T>[] = [];
  const byStage = new Map<string, StageGroup<T>>();
  for (const row of rows) {
    // sentinel can never collide with a real stage name
    const key = JSON.stringify(row.stage); // quoted form cannot collide across null vs strings
    let group = byStage.get(key);
    if (!group) {
      group = { stage: row.stage, rows: [] };
      byStage.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** One recent-activity entry: a graded session (or one sessionless record). */
export interface ActivityEntry {
  /** sessionId when the records share one, else `evidence-<recordId>`. */
  id: string;
  nodeTitle: string;
  /** Session score from the shipped node-score function — no display arithmetic. */
  score: number;
  recordCount: number;
  latestAt: string;
}

export const ACTIVITY_LIMIT = 5;

/**
 * Recent graded activity for one plan (Q7): the plan's evidence grouped by
 * session, newest first, capped for display. Honest empty [] until slice 6
 * produces real sessions.
 */
export function planRecentActivity(
  nodes: KnowledgeNode[],
  evidence: EvidenceRecord[],
  limit: number = ACTIVITY_LIMIT,
): ActivityEntry[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const groups = new Map<string, EvidenceRecord[]>();
  for (const record of evidence) {
    if (!nodeIds.has(record.nodeId)) continue;
    const key = record.sessionId ?? `evidence-${record.id}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  return [...groups.entries()]
    .map(([id, records]) => ({
      id,
      nodeTitle: titles.get(records[0].nodeId) ?? records[0].nodeId,
      score: computeNodeScore(records),
      recordCount: records.length,
      latestAt: records.reduce((latest, r) => (r.createdAt > latest ? r.createdAt : latest), records[0].createdAt),
    }))
    .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1))
    .slice(0, limit);
}

/** Evidence-day streak (FR-25) — thin composition over the shipped domain rollup. */
export function evidenceStreak(records: EvidenceRecord[], now: Date = new Date()): number {
  return computeStreak(records, now);
}

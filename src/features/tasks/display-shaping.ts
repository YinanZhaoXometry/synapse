/**
 * Task Home display shaping (T2; AD-6, ADR-0001): evidence → presentation
 * inputs for the task's exactly-one owned node. Thin composition over the
 * shipped domain functions — no mastery arithmetic lives here. The AD-6
 * boundary is the selector's job: only records attributed to the task's own
 * node may reach the display, so plan (or sibling-task) evidence never moves
 * a task's number.
 */
import type { EvidenceRecord, KnowledgeNode, NodeState, Outcome } from "@/domain/entities";
import { computeTaskRollup, getNodeState, MASTERY_CONFIG } from "@/domain/mastery";

/** The task's own evidence only (AD-6): records attributed to its single node. */
export function taskOwnEvidence(node: KnowledgeNode | undefined, evidence: EvidenceRecord[]): EvidenceRecord[] {
  if (!node) return [];
  return evidence.filter((record) => record.nodeId === node.id);
}

/** One Task-Home mastery presentation input (MasteryRing + state glyph + evidence popover). */
export interface TaskMasteryView {
  /** The task rollup — exactly the single owned node's score (`computeTaskRollup`). */
  score: number;
  state: NodeState;
  hasEvidence: boolean;
  /** The score window's outcome marks, oldest → newest (evidence popover). */
  lastOutcomes: Outcome[];
  /**
   * True when real evidence exists but sits under the anti-inflation gate —
   * the score is capped at 99 and the popover says so (ADR-0001 cap behavior).
   */
  belowGate: boolean;
}

/**
 * The view over the task's own evidence: score/state from the shipped domain
 * functions; the marks re-derive the same recency window the score uses
 * (`MASTERY_CONFIG.window`) so popover and number always agree (plans
 * nodeRowViews precedent).
 */
export function taskMasteryView(node: KnowledgeNode | undefined, evidence: EvidenceRecord[]): TaskMasteryView {
  const records = taskOwnEvidence(node, evidence);
  const window = [...records]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MASTERY_CONFIG.window)
    .map((r) => r.outcome);
  return {
    score: computeTaskRollup(records),
    state: getNodeState(records),
    hasEvidence: records.length > 0,
    lastOutcomes: window.reverse(),
    belowGate: records.length > 0 && records.length < MASTERY_CONFIG.evidenceGate,
  };
}

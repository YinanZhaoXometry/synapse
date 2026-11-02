/**
 * Mastery Score — the one pure function family (AD-6), values per ADR-0001.
 * Every surface reads node scores, states, and rollups from here; none compute their own.
 * Tuning happens only through MASTERY_CONFIG.
 */
import type { EvidenceRecord, NodeState, Outcome } from "./entities";

export const MASTERY_CONFIG = {
  /** Score = mean of the last N evidence outcomes on the node. */
  window: 5,
  /** Outcome values (ADR-0001): correct 1, partial 0.5, wrong/forfeit 0. */
  outcomeValues: { correct: 1, partial: 0.5, wrong: 0 } satisfies Record<Outcome, number>,
  /** mastered requires score ≥ threshold… */
  masteredThreshold: 80,
  /** …AND at least this many total evidence records (anti-inflation gate, SM-C2). */
  evidenceGate: 3,
} as const;

/** Recent evidence first: the window is over recency by createdAt, not insertion order. */
function recentFirst(records: EvidenceRecord[]): EvidenceRecord[] {
  return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** round(100 × mean of the node's last-5 outcomes); 0 with no evidence. */
export function computeNodeScore(records: EvidenceRecord[]): number {
  if (records.length === 0) return 0;
  const recent = recentFirst(records).slice(0, MASTERY_CONFIG.window);
  const values = recent.map((r) => MASTERY_CONFIG.outcomeValues[r.outcome]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(100 * mean);
}

/** uncovered (no evidence) / partial / mastered (score ≥80 AND ≥3 total records). */
export function getNodeState(records: EvidenceRecord[]): NodeState {
  if (records.length === 0) return "uncovered";
  const score = computeNodeScore(records);
  const gateMet = records.length >= MASTERY_CONFIG.evidenceGate;
  return score >= MASTERY_CONFIG.masteredThreshold && gateMet ? "mastered" : "partial";
}

export interface NodeSummary {
  nodeId: string;
  score: number;
  state: NodeState;
}

/** Per-node surface contract (NodeRow / MasteryRing / EvidencePopover inputs). */
export function summarizeNodes(evidenceByNode: Record<string, EvidenceRecord[]>): NodeSummary[] {
  return Object.entries(evidenceByNode).map(([nodeId, records]) => ({
    nodeId,
    score: computeNodeScore(records),
    state: getNodeState(records),
  }));
}

/**
 * Plan rollup (AD-6): mean of node scores, uncovered nodes counting 0.
 * 100% only when every node is mastered — the readiness display contract (SM-C2).
 */
export function computePlanRollup(evidenceByNode: Record<string, EvidenceRecord[]>): number {
  const summaries = summarizeNodes(evidenceByNode);
  if (summaries.length === 0) return 0;
  const total = summaries.reduce((sum, n) => sum + n.score, 0);
  return Math.round(total / summaries.length);
}

/**
 * Study Task rollup (AD-6): exactly its single owned node's score —
 * no other rollup exists.
 */
export function computeTaskRollup(records: EvidenceRecord[]): number {
  return computeNodeScore(records);
}

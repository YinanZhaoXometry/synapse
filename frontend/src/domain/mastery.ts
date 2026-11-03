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
  /**
   * Freshness window (ADR-0001 amendment 2026-11-04, ticket 04): a node whose
   * LATEST evidence record is older than this many days caps at 99 and never
   * reads mastered — a stale score does not certify (NFR-8). Tuning is one line.
   */
  freshnessDays: 14,
} as const;

/** A day in milliseconds — the freshness boundary arithmetic (exact on integral instants). */
const DAY_MS = 86_400_000;

/**
 * The instant freshness is judged against. Optional everywhere: injected `now`
 * engages the freshness cap (the api resolvers always inject; ADR-0001 amendment
 * 2026-11-04); omitted `now` keeps the identical Phase-1 read (mirrors how
 * computeStreak's dayBoundary default preserved Phase-1 behavior).
 */
type Now = Date | string;

/** Recent evidence first: the window is over recency by createdAt, not insertion order. */
function recentFirst(records: EvidenceRecord[]): EvidenceRecord[] {
  return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Freshness cap predicate (ADR-0001 amendment 2026-11-04, ticket 04): the node's
 * LATEST evidence record (newest createdAt — the same recency the window reads)
 * is strictly more than freshnessDays old. Exactly 14 days is fresh; 14 days +
 * 1 second is stale. Never called with an empty list.
 */
function freshnessExpired(records: EvidenceRecord[], now: Now): boolean {
  const latest = records.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), records[0].createdAt);
  return new Date(now).getTime() - new Date(latest).getTime() > MASTERY_CONFIG.freshnessDays * DAY_MS;
}

/**
 * round(100 × mean of the node's last-5 outcomes); 0 with no evidence.
 * A node caps at 99 — score 100 must mean *verified, current* mastery — on
 * either of two "display at most 99" conditions, composed as the max cap:
 * below the evidence gate (ADR-0001 amendment 2026-11-02; the rollup could
 * otherwise hit 100% on un-gated nodes), or past the freshness window on the
 * latest record (amendment 2026-11-04, ticket 04: a stale score does not
 * certify; NFR-8). The cap never lowers a sub-99 score — only the 100/mastered
 * seal expires.
 */
export function computeNodeScore(records: EvidenceRecord[], now?: Now): number {
  if (records.length === 0) return 0;
  const recent = recentFirst(records).slice(0, MASTERY_CONFIG.window);
  const values = recent.map((r) => MASTERY_CONFIG.outcomeValues[r.outcome]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const raw = Math.round(100 * mean);
  const gated = records.length < MASTERY_CONFIG.evidenceGate;
  const stale = now !== undefined && freshnessExpired(records, now);
  return gated || stale ? Math.min(raw, 99) : raw;
}

/** uncovered (no evidence) / partial / mastered (score ≥80 AND ≥3 total records AND fresh). */
export function getNodeState(records: EvidenceRecord[], now?: Now): NodeState {
  if (records.length === 0) return "uncovered";
  const score = computeNodeScore(records, now);
  const gateMet = records.length >= MASTERY_CONFIG.evidenceGate;
  const stale = now !== undefined && freshnessExpired(records, now);
  return score >= MASTERY_CONFIG.masteredThreshold && gateMet && !stale ? "mastered" : "partial";
}

export interface NodeSummary {
  nodeId: string;
  score: number;
  state: NodeState;
}

/** Per-node surface contract (NodeRow / MasteryRing / EvidencePopover inputs). */
export function summarizeNodes(evidenceByNode: Record<string, EvidenceRecord[]>, now?: Now): NodeSummary[] {
  return Object.entries(evidenceByNode).map(([nodeId, records]) => ({
    nodeId,
    score: computeNodeScore(records, now),
    state: getNodeState(records, now),
  }));
}

/**
 * Plan rollup (AD-6): mean of node scores, uncovered nodes counting 0 — FLOORED
 * to the whole percent (ADR-0001 amendment 2026-11-04). The golden vectors caught
 * half-up's tie breaking the readiness invariant: Math.round((100+99)/2) = 100,
 * so one unverified 99-node could display a 100% plan (and (n·100−1)/n ≥ 99.5 for
 * every plan size ≥ 2). Floor makes 100 arithmetically reachable only when every
 * node scores 100 (⇔ every node mastered) — one rounding rule, monotone, no
 * all-mastered special case. Node-level rounding is unchanged (half-up, above).
 * Freshness rides the node scores: with `now` injected a decayed node caps at 99
 * and can never certify (amendment 2026-11-04, ticket 04).
 */
export function computePlanRollup(evidenceByNode: Record<string, EvidenceRecord[]>, now?: Now): number {
  const summaries = summarizeNodes(evidenceByNode, now);
  if (summaries.length === 0) return 0;
  const total = summaries.reduce((sum, n) => sum + n.score, 0);
  return Math.floor(total / summaries.length);
}

/**
 * Study Task rollup (AD-6): exactly its single owned node's score —
 * no other rollup exists.
 */
export function computeTaskRollup(records: EvidenceRecord[], now?: Now): number {
  return computeNodeScore(records, now);
}

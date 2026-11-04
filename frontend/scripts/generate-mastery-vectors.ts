/**
 * Golden-vector generator (epic P2-4 ticket 01) — AD-14's contract made mechanical.
 *
 * Derives mastery/streak vectors from the TS source of truth (domain/mastery.ts +
 * domain/streak.ts — the one implementation until the cutover retires it, AD-6/AD-14)
 * and writes backend/spec/fixtures/mastery_vectors.json for the Ruby port's RSpec
 * exact-equality suite (ticket 02).
 *
 * Run: pnpm run generate:mastery-vectors   (node 24+ native type stripping; no extra dep)
 *
 * Self-checks run BEFORE any write (fail → exit 1, fixture untouched):
 *   1. Known-answer literals from ADR-0001 + the committed corpus tests (independent
 *      source of truth — never recomputed through the generator's own expectations).
 *   2. Contract invariants: mastery-derived numerics as strings; timestamps
 *      timezone-tagged ISO-8601; case ids unique + sorted; category matrix complete.
 *   3. Determinism: the document is built twice in-process and must be byte-identical.
 * CI adds the fourth leg: regenerate + stamp-insensitive diff (anti-drift until cutover).
 *
 * Determinism notes:
 *   - "now" is always injected; the host clock never enters the fixture.
 *   - The process timezone is pinned (TZ=UTC) before any Date is constructed, so the
 *     Phase-1 "local" day boundary is simulated on a fixed zone, never the host's.
 *     The local-vs-UTC divergence case pins a second fixed zone (Asia/Shanghai, no DST).
 *   - Equal-timestamp evidence ties are pinned (review P2-5): the window's recency
 *     sort breaks them by insertion order, the EARLIER-inserted record being the
 *     OLDER recency (the later-inserted survives at the window boundary). On the TS
 *     side that is the V8-observed behavior of the comparator in domain/mastery.ts;
 *     the Ruby port makes the same tiebreak explicit because Ruby's sort is not
 *     stable. The regenerate-and-diff leg guards that this still holds on whatever
 *     engine regenerates.
 *   - `generatedAtSourceCommit` is ADVISORY provenance, not part of the anti-drift
 *     contract (epic P2-4 review): SOURCE_PATHS includes this generator and fixture
 *     commits ride generator edits, so the stamp is self-referential — a vector-
 *     extending commit always lands a stamp pointing at the commit BEFORE it (fired
 *     in practice: 7a6c4b3, f69f7aa). CI's regenerate-and-diff therefore strips
 *     .meta.generatedAtSourceCommit from both sides before diffing; refreshing the
 *     stamp on a vector-extending commit is a courtesy, never a chore the gate
 *     demands. Its FORMAT (a full 40-hex sha) stays pinned by
 *     backend/spec/lib/mastery_spec.rb.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the simulated browser timezone BEFORE any Date construction. The imported
// domain modules construct Dates only inside their functions (never at import time).
process.env.TZ = "UTC";

import type { EvidenceRecord, Outcome } from "../src/domain/entities.ts";
import {
  MASTERY_CONFIG,
  computeNodeScore,
  computePlanRollup,
  computeTaskRollup,
  getNodeState,
  summarizeNodes,
} from "../src/domain/mastery.ts";
import { computeStreak } from "../src/domain/streak.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE_PATH = path.join(REPO_ROOT, "backend", "spec", "fixtures", "mastery_vectors.json");
const SOURCE_PATHS = [
  "frontend/src/domain/mastery.ts",
  "frontend/src/domain/streak.ts",
  "frontend/scripts/generate-mastery-vectors.ts",
];

/** The pinned instant "today" for every streak case (never the host clock). */
const STREAK_NOW = "2026-11-05T21:00:00Z";

/**
 * The freshness boundary instants (ADR-0001 amendment 2026-11-04, ticket 04).
 * The decay corpus's newest evidence record is 2026-11-05T10:00:00Z, so
 * FRESH_NOW is exactly freshnessDays (14) later — fresh — and FRESH_NOW + 1s
 * is the first stale instant (strictly-greater comparison).
 */
const FRESH_NOW = "2026-11-19T10:00:00Z";
const STALE_NOW = "2026-11-19T10:00:01Z";

type VectorCategory = "node_score" | "rollup" | "task_rollup" | "streak" | "streak_divergence" | "decay";

interface VectorCase {
  id: string;
  category: VectorCategory;
  description: string;
  call: "computeNodeScore" | "computePlanRollup" | "computeTaskRollup" | "computeStreak";
  input: {
    evidence?: EvidenceRecord[];
    evidenceByNode?: Record<string, EvidenceRecord[]>;
    now?: string;
    dayBoundary?: "local" | "utc";
  };
  expected: {
    score?: string;
    state?: string;
    meanOfWindowedValues?: string | null;
    rollup?: string;
    nodes?: { nodeId: string; score: string; state: string }[];
    streak?: string;
  };
  note?: string;
}

interface FixtureDocument {
  meta: Record<string, unknown>;
  cases: VectorCase[];
}

/** Deterministic record factory — fresh sequence per build, zero host state. */
function makeEv() {
  let seq = 0;
  return (outcome: Outcome, createdAt: string, nodeId = "n1"): EvidenceRecord => {
    seq += 1;
    return {
      id: `rec-${String(seq).padStart(3, "0")}`,
      nodeId,
      sessionId: null,
      questionId: null,
      outcome,
      createdAt,
    };
  };
}

/** The documented operation order (meta.rounding.operationOrder) — for the intermediate-mean field. */
function windowedMean(records: EvidenceRecord[]): number | null {
  if (records.length === 0) return null;
  const recent = [...records]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MASTERY_CONFIG.window);
  const values = recent.map((r) => MASTERY_CONFIG.outcomeValues[r.outcome]);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function nodeCase(
  id: string,
  description: string,
  evidence: EvidenceRecord[],
  now?: string,
  category: VectorCategory = "node_score",
): VectorCase {
  const mean = windowedMean(evidence);
  return {
    id,
    category,
    description,
    call: "computeNodeScore",
    input: { evidence: evidence.map((r) => ({ ...r })), ...(now ? { now } : {}) },
    expected: {
      score: String(computeNodeScore(evidence, now)),
      state: getNodeState(evidence, now),
      meanOfWindowedValues: mean === null ? null : String(mean),
    },
  };
}

function rollupCase(
  id: string,
  description: string,
  evidenceByNode: Record<string, EvidenceRecord[]>,
  note?: string,
  now?: string,
  category: VectorCategory = "rollup",
): VectorCase {
  const nodes = summarizeNodes(evidenceByNode, now)
    .sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0))
    .map((n) => ({ nodeId: n.nodeId, score: String(n.score), state: n.state }));
  const serialized: Record<string, EvidenceRecord[]> = {};
  for (const nodeId of Object.keys(evidenceByNode).sort()) {
    serialized[nodeId] = evidenceByNode[nodeId].map((r) => ({ ...r }));
  }
  return {
    id,
    category,
    description,
    call: "computePlanRollup",
    input: { evidenceByNode: serialized, ...(now ? { now } : {}) },
    expected: { rollup: String(computePlanRollup(evidenceByNode, now)), nodes },
    note,
  };
}

function taskCase(
  id: string,
  description: string,
  evidence: EvidenceRecord[],
): VectorCase {
  return {
    id,
    category: "task_rollup",
    description,
    call: "computeTaskRollup",
    input: { evidence: evidence.map((r) => ({ ...r })) },
    expected: { rollup: String(computeTaskRollup(evidence)) },
  };
}

function streakCase(
  id: string,
  category: VectorCategory,
  description: string,
  evidence: EvidenceRecord[],
  dayBoundary: "local" | "utc",
  note?: string,
  now: string = STREAK_NOW,
): VectorCase {
  return {
    id,
    category,
    description,
    call: "computeStreak",
    input: {
      evidence: evidence.map((r) => ({ ...r })),
      now,
      dayBoundary,
    },
    expected: {
      streak: String(
        computeStreak(evidence, new Date(now), { dayBoundary }),
      ),
    },
    note,
  };
}

/** Last commit that touched the behavior-bearing files — the fixture's provenance pin. */
function sourceCommit(): string {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%H", "--", ...SOURCE_PATHS],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();
    return out.length > 0 ? out : "unavailable (no commit touches the source paths)";
  } catch {
    // Shallow clone without the path's history — CI sets fetch-depth: 0 to avoid this.
    return "unavailable (git history unavailable)";
  }
}

function buildDocument(): FixtureDocument {
  const ev = makeEv();
  const cases: VectorCase[] = [];

  // ── Node score: every threshold both directions (ADR-0001; corpus-derived) ──
  cases.push(
    nodeCase(
      "node-score.empty-node-scores-zero-uncovered",
      "No evidence — the node scores 0 and reads uncovered, never green (the floor edge of every threshold).",
      [],
    ),
    nodeCase(
      "node-score.all-wrong-zero-but-partial",
      "Three wrongs (forfeits grade wrong, FR-18) score 0 yet read partial — evidence exists, so never uncovered.",
      [ev("wrong", "2026-11-01T10:00:00Z"), ev("wrong", "2026-11-02T10:00:00Z"), ev("wrong", "2026-11-03T10:00:00Z")],
    ),
    nodeCase(
      "node-score.forfeit-window-four-records-just-below-75",
      "Threshold, below direction: 3 corrects + 1 forfeit-as-wrong in 4 records → 75 < 80, partial. Also pins that an unfilled window divides by the record count (4), never the window size (5).",
      [ev("wrong", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-03T10:00:00Z"), ev("correct", "2026-11-04T10:00:00Z")],
    ),
    nodeCase(
      "node-score.threshold-at-80-mastered",
      "Threshold, at direction: 4 corrects + 1 wrong over the full window → exactly 80 → mastered (score ≥ 80 AND gate 5 ≥ 3).",
      [ev("wrong", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-03T10:00:00Z"), ev("correct", "2026-11-04T10:00:00Z"), ev("correct", "2026-11-05T10:00:00Z")],
    ),
    nodeCase(
      "node-score.threshold-above-rounding-83-mastered",
      "Above threshold with partial credit: correct+correct+partial → mean 0.8333… → 83 → mastered.",
      [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("partial", "2026-11-03T10:00:00Z")],
    ),
    nodeCase(
      "node-score.rounding-half-up-tie-38",
      "Rounding-mode pin: correct+partial+wrong+wrong → 1.5/4 = 0.375 → 37.5 → rounds half-UP to 38 (half-down or half-even would read 37 — the Ruby port must tie toward +∞).",
      [ev("correct", "2026-11-01T10:00:00Z"), ev("partial", "2026-11-02T10:00:00Z"), ev("wrong", "2026-11-03T10:00:00Z"), ev("wrong", "2026-11-04T10:00:00Z")],
    ),
    nodeCase(
      "node-score.gate-edge-two-records-cap-99",
      "Evidence gate, below direction: 2 total records — the raw 100 is capped at 99 (the gate caps the SCORE, not only the state; ADR-0001 amendment 2026-11-02), partial.",
      [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z")],
    ),
    nodeCase(
      "node-score.gate-edge-three-records-masters",
      "Evidence gate, at direction: the 3rd record lifts the gate — 3 corrects score 100 and read mastered.",
      [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-03T10:00:00Z")],
    ),
    nodeCase(
      "node-score.single-record-cap-99",
      "One lucky answer: a single correct caps at 99 and stays partial — the anti-inflation gate (SM-C2).",
      [ev("correct", "2026-11-01T10:00:00Z")],
    ),
    nodeCase(
      "node-score.window-edge-six-records-oldest-wrong-ages-out",
      "Window edge, aging-out direction: 6 records — the oldest (wrong) falls OUT of the last-5 window → 100 (a window of 6 would read 83).",
      [ev("wrong", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-03T10:00:00Z"), ev("correct", "2026-11-04T10:00:00Z"), ev("correct", "2026-11-05T10:00:00Z"), ev("correct", "2026-11-06T10:00:00Z")],
    ),
    nodeCase(
      "node-score.window-edge-six-records-oldest-correct-excluded",
      "Window edge, exclusion direction: 6 records, newest first = wrong then 5 corrects — the OLDEST correct is what the window excludes → 80 (a window of 6 would read 83); pins which record falls out.",
      [ev("wrong", "2026-11-06T10:00:00Z"), ev("correct", "2026-11-05T10:00:00Z"), ev("correct", "2026-11-04T10:00:00Z"), ev("correct", "2026-11-03T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-01T10:00:00Z")],
    ),
    nodeCase(
      "node-score.window-recency-by-createdAt-not-insertion",
      "The window follows createdAt recency, not array insertion order (corpus case): shuffled input sorts to c,c,c,w,c → 80.",
      [ev("correct", "2026-11-05T10:00:00Z"), ev("correct", "2026-11-01T10:00:00Z"), ev("wrong", "2026-11-03T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("correct", "2026-11-04T10:00:00Z")],
    ),
    nodeCase(
      "node-score.window-tie-equal-createdAt-earlier-insert-ages-out",
      "Equal-timestamp tie straddling the window boundary: 6 records, the two oldest sharing one createdAt — the tie breaks by insertion order with the EARLIER-inserted record as the OLDER recency, so the later-inserted wrong stays in the window (80) while the earlier-inserted correct ages out (a reverse tiebreak would read 100). Ruby's sort is not stable — the index tiebreak is explicit on both sides (review P2-5).",
      [
        ev("correct", "2026-11-01T10:00:00Z"),
        ev("wrong", "2026-11-01T10:00:00Z"),
        ev("correct", "2026-11-02T10:00:00Z"),
        ev("correct", "2026-11-03T10:00:00Z"),
        ev("correct", "2026-11-04T10:00:00Z"),
        ev("correct", "2026-11-05T10:00:00Z"),
      ],
    ),
  );

  // ── Plan rollup: uncovered nodes, rounding, the 99-cap interplay (verbatim) ──
  const mastered = (): EvidenceRecord[] =>
    [1, 2, 3].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
  const half = (): EvidenceRecord[] =>
    [ev("correct", "2026-11-01T10:00:00Z"), ev("partial", "2026-11-02T10:00:00Z"), ev("wrong", "2026-11-03T10:00:00Z")];
  const perfectUnverified = (): EvidenceRecord[] =>
    [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z")];

  cases.push(
    rollupCase(
      "rollup.empty-plan-scores-zero",
      "A plan with no nodes scores 0 (the empty-summaries branch).",
      {},
    ),
    rollupCase(
      "rollup.uncovered-node-counts-zero",
      "Corpus case: the rollup is the mean of node scores with uncovered nodes counting 0 — (100 + 50 + 0)/3 → 50.",
      { alphaMastered: mastered(), betaHalf: half(), gammaUncovered: [] },
    ),
    rollupCase(
      "rollup.rounding-mean-of-scores-83",
      "Corpus case: (100 + 100 + 50)/3 = 83.33… → 83 — the rollup floors its mean exactly once (ADR-0001 amendment 2026-11-04).",
      { alphaMastered: mastered(), betaMastered: mastered(), gammaHalf: half() },
    ),
    rollupCase(
      "rollup.all-mastered-exactly-100",
      "Every node mastered → the rollup is exactly 100 — the readiness display contract (SM-C2).",
      { alphaMastered: mastered(), betaMastered: mastered(), gammaMastered: mastered() },
    ),
    rollupCase(
      "rollup.cap-two-node-tie-floors-below-100",
      "99-cap interplay, resolved direction: one mastered node (100) + one perfect-but-unverified node (99) → mean 99.5 → the floored rollup reads 99, NOT 100. The pre-amendment half-up rounding turned this tie into 100 (ticket 01's flagged finding); ADR-0001 amended 2026-11-04 floors the rollup mean, restoring '100% only when every node is mastered'. Generated verbatim per AD-14/delta-review item 6.",
      { alphaMastered: mastered(), betaPerfectUnverified: perfectUnverified() },
      "Floored behavior: Math.floor((100+99)/2) = Math.floor(99.5) = 99. The pre-amendment half-up tie read 100 (ticket 01's rollup.cap-two-node-tie-reaches-100); the amendment (ticket 02, both sides together per AD-14) floors the rollup so the tie rounds DOWN.",
    ),
    rollupCase(
      "rollup.cap-two-unverified-hold-below-100",
      "99-cap interplay, holding direction: one mastered (100) + two perfect-but-unverified (99 each) → 298/3 = 99.33… → 99, below 100.",
      { alphaMastered: mastered(), betaUnverified: perfectUnverified(), gammaUnverified: perfectUnverified() },
    ),
    rollupCase(
      "rollup.single-node-plan-is-node-score",
      "A one-node plan's rollup is exactly that node's score (83) — no other rollup exists (AD-6).",
      { solo: [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("partial", "2026-11-03T10:00:00Z")] },
    ),
  );

  // ── Study Task rollup: exactly its single node's score (ADR consequence verbatim) ──
  cases.push(
    taskCase(
      "task.empty-task-rollup-zero",
      "A Study Task with no evidence rolls up to 0.",
      [],
    ),
    taskCase(
      "task.single-node-rollup-is-node-score",
      "Corpus case: the task rollup is exactly its single owned node's score — correct+correct+partial → 83.",
      [ev("correct", "2026-11-01T10:00:00Z"), ev("correct", "2026-11-02T10:00:00Z"), ev("partial", "2026-11-03T10:00:00Z")],
    ),
  );

  // ── Streak: UTC contract vectors (pinned policy, ADR-0001 amendment 2026-11-04) ──
  const nov = (day: number, hour = 12) =>
    `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;

  cases.push(
    streakCase(
      "streak.utc.empty-no-evidence-zero",
      "streak",
      "No evidence records → streak 0.",
      [],
      "utc",
    ),
    streakCase(
      "streak.utc.consecutive-days-ending-today-alive",
      "streak",
      "Three consecutive evidence days ending today → 3 (the alive baseline; corpus case).",
      [ev("correct", nov(3)), ev("correct", nov(4)), ev("correct", nov(5))],
      "utc",
    ),
    streakCase(
      "streak.utc.yesterday-alive-today-missing",
      "streak",
      "Latest evidence exactly 1 day ago (yesterday) → alive at 1 — a day isn't over until it's over (the alive side of the day-distance boundary).",
      [ev("correct", nov(4))],
      "utc",
    ),
    streakCase(
      "streak.utc.two-day-gap-broken",
      "streak",
      "Latest evidence exactly 2 days ago → broken, 0 (daysBetween(latest, today) = 2 > 1 — the broken side of the day-distance boundary; corpus case).",
      [ev("correct", nov(1)), ev("correct", nov(2)), ev("correct", nov(3))],
      "utc",
    ),
    streakCase(
      "streak.utc.same-day-multiple-records-one-day",
      "streak",
      "Multiple records within one UTC day count as ONE evidence day → 1 (corpus case).",
      [ev("correct", nov(5, 8)), ev("correct", nov(5, 12)), ev("correct", nov(5, 20))],
      "utc",
    ),
    streakCase(
      "streak.utc.old-run-behind-gap-ignored",
      "streak",
      "An older run behind a gap never adds to the current run: Oct 20 + a full Nov 1–5 run → 5 (corpus case).",
      [
        ev("correct", "2026-10-20T12:00:00Z"),
        ev("correct", nov(1)),
        ev("correct", nov(2)),
        ev("correct", nov(3)),
        ev("correct", nov(4)),
        ev("correct", nov(5)),
      ],
      "utc",
    ),
    streakCase(
      "streak.utc.day-straddle-23-59-vs-00-01-two-days",
      "streak",
      "The UTC day edge, both sides: 23:59Z (Nov 4) and 00:01Z (Nov 5) are two UTC evidence days, latest = today → 2.",
      [ev("correct", "2026-11-04T23:59:00Z"), ev("correct", "2026-11-05T00:01:00Z")],
      "utc",
    ),
    streakCase(
      "streak.utc.same-utc-day-one-day",
      "streak",
      "22:00Z and 23:59Z on the same UTC day (Nov 4) are ONE evidence day → 1.",
      [ev("correct", "2026-11-04T22:00:00Z"), ev("correct", "2026-11-04T23:59:00Z")],
      "utc",
    ),
    streakCase(
      "streak.local.simulated-utc.consecutive-days-alive",
      "streak",
      "Phase-1 default (dayBoundary 'local') on the same instants as the utc baseline, with the local calendar simulated as UTC → 3, identical to the UTC contract for a UTC browser: the default path is preserved unchanged.",
      [ev("correct", nov(3)), ev("correct", nov(4)), ev("correct", nov(5))],
      "local",
      "Generated with the runtime timezone pinned to UTC (meta.streak.localModeVectors) — the host's own zone never leaks into the fixture.",
    ),
    streakCase(
      "streak.local.simulated-utc.two-day-gap-broken",
      "streak",
      "Phase-1 default (local) simulated as UTC, broken direction → 0, matching the UTC contract.",
      [ev("correct", nov(1)), ev("correct", nov(2)), ev("correct", nov(3))],
      "local",
    ),
  );

  // ── The pinned local-vs-UTC divergence (why the boundary needed pinning) ──
  // Executed under a fixed simulated zone (Asia/Shanghai, no DST) so the case is
  // deterministic on every host; both records are Nov 5 in UTC+08 wall time.
  const divergenceRecords = (): EvidenceRecord[] => [
    ev("correct", "2026-11-04T18:00:00Z"),
    ev("correct", "2026-11-05T02:00:00Z"),
  ];
  cases.push(
    streakCase(
      "streak.divergence.utc-mode-counts-two-days",
      "streak_divergence",
      "The pinned UTC contract on the divergence instants: 18:00Z is UTC Nov 4, 02:00Z is UTC Nov 5 — two evidence days, latest = today → 2.",
      divergenceRecords(),
      "utc",
    ),
  );
  process.env.TZ = "Asia/Shanghai";
  try {
    cases.push(
      streakCase(
        "streak.divergence.local-mode-simulated-asia-shanghai-one-day",
        "streak_divergence",
        "The SAME instants under the Phase-1 local boundary, local calendar simulated as Asia/Shanghai (UTC+08, no DST): both records fall on local Nov 5 (02:00 and 10:00) — one local day; 'now' is local Nov 6 05:00, so the latest day is yesterday → 1. The UTC sibling counts 2. THIS divergence is why AD-14 pins UTC: a server cannot reproduce a browser's local calendar (ADR-0001, amended 2026-11-04).",
        divergenceRecords(),
        "local",
        "Generated with the runtime timezone pinned to Asia/Shanghai — the host's own zone never leaks into the fixture.",
      ),
    );
  } finally {
    process.env.TZ = "UTC";
  }

  // ── Freshness/decay boundary matrix (ADR-0001 amendment 2026-11-04, ticket 04) ──
  // Every decay case injects `now` (the freshness cap engages only on injection;
  // the 33 pre-existing cases above pass none and pin the Phase-1 posture).
  // Boundary: the newest record below is 2026-11-05T10:00:00Z, so exactly-14-days
  // is 2026-11-19T10:00:00Z (fresh) and +1s (2026-11-19T10:00:01Z) is stale.
  const threeCorrect = (): EvidenceRecord[] => [
    ev("correct", "2026-11-03T10:00:00Z"),
    ev("correct", "2026-11-04T10:00:00Z"),
    ev("correct", "2026-11-05T10:00:00Z"),
  ];
  const fiveCorrect = (): EvidenceRecord[] =>
    [1, 2, 3, 4, 5].map((i) => ev("correct", `2026-11-0${i}T10:00:00Z`));
  const twoCorrectOld = (): EvidenceRecord[] => [
    ev("correct", "2026-10-21T10:00:00Z"),
    ev("correct", "2026-10-22T10:00:00Z"),
  ];

  cases.push(
    nodeCase(
      "decay.boundary-exactly-14-days-fresh-certifies",
      "Freshness boundary, fresh direction: the latest record is EXACTLY freshnessDays (14) old — strictly-greater comparison keeps it fresh, so the node certifies 100/mastered.",
      threeCorrect(),
      FRESH_NOW,
      "decay",
    ),
    nodeCase(
      "decay.boundary-14-days-plus-1s-caps-99-partial",
      "Freshness boundary, stale direction: one second past the window the SAME evidence caps at 99 and reads partial — a stale score does not certify (NFR-8; ADR-0001 amendment 2026-11-04).",
      threeCorrect(),
      STALE_NOW,
      "decay",
    ),
    nodeCase(
      "decay.mastered-node-decays-to-partial",
      "A mastered node decaying: the full-window 100/mastered node's state DROPS to partial with its score capped at 99 — the 100/mastered seal expires, the evidence stays.",
      fiveCorrect(),
      STALE_NOW,
      "decay",
    ),
    nodeCase(
      "decay.stale-sub-99-score-unchanged-partial",
      "The cap never drifts a sub-99 score downward: stale 83 stays 83 (c,c,partial) and only mastery is withheld — freshness is a cap, not a percent decay (the rejected alternative).",
      [
        ev("correct", "2026-11-03T10:00:00Z"),
        ev("correct", "2026-11-04T10:00:00Z"),
        ev("partial", "2026-11-05T10:00:00Z"),
      ],
      STALE_NOW,
      "decay",
    ),
    rollupCase(
      "decay.rollup-one-decayed-node-holds-below-100",
      "Rollup with one decayed node: fresh mastered (100, latest record 11 days old) + decayed (99, latest 27 days old) → floor(199/2) = 99 — a decayed node can never certify, so the plan cannot read 100 (rollup 100 ⇔ every node mastered survives the freshness layer).",
      {
        freshNode: [ev("correct", "2026-11-06T10:00:00Z"), ev("correct", "2026-11-07T10:00:00Z"), ev("correct", "2026-11-08T10:00:00Z")],
        decayedNode: [ev("correct", "2026-10-21T10:00:00Z"), ev("correct", "2026-10-22T10:00:00Z"), ev("correct", "2026-10-23T10:00:00Z")],
      },
      "Generated with now injected (2026-11-19T10:00:01Z): the fresh node is 11 days inside the window, the decayed node 27 days past it.",
      STALE_NOW,
      "decay",
    ),
    nodeCase(
      "decay.gate-cap-and-freshness-cap-both-99",
      "Gate × freshness interplay: 2 records (gate unmet) AND 28 days stale — both caps are 'display at most 99', composed as the max cap → still 99, partial (no double-penalty beyond the shared cap).",
      twoCorrectOld(),
      STALE_NOW,
      "decay",
    ),
    streakCase(
      "decay.streak-own-rule-ignores-freshness",
      "decay",
      "The streak is untouched by the freshness layer: at 14 days + 1s past the only evidence day it reads 0 by the streak's OWN two-day-gap rule — decay adds no second break rule and no 99-cap vocabulary to the streak.",
      [ev("correct", "2026-11-05T10:00:00Z")],
      "utc",
      "Generated at the freshness boundary instant (now 2026-11-19T10:00:01Z) to pin that computeStreak's contract is independent of freshnessDays.",
      STALE_NOW,
    ),
  );

  // Stable + sorted: lexicographic id order, asserted below.
  cases.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const meta = {
    contract:
      "AD-14 golden vectors — exact-equality parity between the TS source of truth (until cutover) and the Ruby port. Zero tolerance: no epsilon, no rounding on comparison.",
    sourceOfTruth: {
      nodeScore: "frontend/src/domain/mastery.ts",
      streak: "frontend/src/domain/streak.ts",
      note: "The TS implementation IS the source until the cutover retires it (AD-6/AD-14). The Ruby port pins itself to these vectors verbatim; ambiguities amend ADR-0001 first, both sides together.",
    },
    generatedAtSourceCommit: sourceCommit(),
    generator: "frontend/scripts/generate-mastery-vectors.ts (pnpm run generate:mastery-vectors)",
    fixtureEncoding: {
      decimals:
        "Every mastery-derived numeric (scores, rollups, streaks, intermediate means) is a decimal STRING — parse on the Ruby side; never compare JSON number literals (AD-14).",
      timestamps:
        "ISO-8601, timezone-tagged; every instant in this fixture is UTC (Z). Streak 'now' is injected per case — never the host clock.",
      comparison: "Exact equality on the Ruby side.",
      ordering:
        "Case ids sorted lexicographically; object keys in stable construction order; regeneration is byte-identical (asserted in the generator's self-check and by CI's generate-and-diff step).",
    },
    config: {
      window: MASTERY_CONFIG.window,
      evidenceGate: MASTERY_CONFIG.evidenceGate,
      masteredThreshold: MASTERY_CONFIG.masteredThreshold,
      freshnessDays: MASTERY_CONFIG.freshnessDays,
      outcomeValues: {
        correct: String(MASTERY_CONFIG.outcomeValues.correct),
        partial: String(MASTERY_CONFIG.outcomeValues.partial),
        wrong: String(MASTERY_CONFIG.outcomeValues.wrong),
      },
      note: "Mirrors MASTERY_CONFIG verbatim (ADR-0001 consequences); the Ruby port's constants must match (tickets 02 + 04).",
    },
    freshness: {
      rule:
        "ADR-0001 amendment 2026-11-04 (epic P2-4 ticket 04): a node whose LATEST evidence record (newest createdAt — the window's own recency) is strictly more than freshnessDays old caps its score at 99 and never reads mastered. Exactly freshnessDays old is fresh; one second past is stale. The windowed-mean math is untouched, and the cap composes with the <3-evidence gate as the max of two 'display at most 99' caps. A decayed node can never certify, so rollup 100 ⇔ every node mastered survives.",
      injectionPosture:
        "The freshness check engages only where the caller injects 'now' (the api's score resolvers always do — Time.current). Cases without input.now (the 33 pre-flight cases) pin the Phase-1 posture: no injection, no freshness; the decay cases (category 'decay') all inject input.now.",
      streak:
        "The streak has NO freshness rule — its own today/yesterday aliveness is its whole freshness story (pinned by decay.streak-own-rule-ignores-freshness).",
    },
    rounding: {
      mode:
        "Two pinned postures (ADR-0001, amended 2026-11-04): node score rounds with ECMAScript Math.round — half toward +infinity, a x.5 tie rounds UP (37.5 → 38); plan rollup FLOORS its mean — Math.floor, a x.5 tie rounds DOWN (99.5 → 99), which is what keeps 100 arithmetically reachable only when every node scores 100. Applied once per level; no intermediate rounding anywhere.",
      operationOrder: {
        nodeScore:
          "sort evidence newest-first by createdAt → take the first window (5) → map outcomes to values → sum → divide by the WINDOWED COUNT (values.length) → multiply by 100 → Math.round → if TOTAL records (all, not windowed) < evidenceGate (3) OR (now injected AND the newest record is more than freshnessDays (14) old): min(result, 99).",
        planRollup:
          "mean of node scores (uncovered nodes count 0): sum node scores → divide by the node count → Math.floor once (amendment 2026-11-04; half-up's 99.5 → 100 tie used to let one unverified 99-node read a 100% plan). No per-node re-rounding, no clamping — the floor IS the readiness invariant's arithmetic. Node scores carry freshness when now is injected (ticket 04).",
        taskRollup:
          "exactly computeNodeScore of the task's single owned node — no other rollup exists (AD-6).",
      },
      pinnedBy:
        "ADR-0001, amendments 2026-11-04 (epic P2-4 tickets 01+02+04) — whatever domain/mastery.ts does is verbatim (delta-review item 6).",
    },
    streak: {
      dayBoundaryPolicy:
        "The pinned contract is the UTC calendar day (dayBoundary: 'utc'). The Phase-1 default stays browser-local ('local', behavior unchanged); the Ruby port implements UTC because a server cannot know a browser's local time — a per-user timezone stays a deferred row. ADR-0001, amended 2026-11-04.",
      contractVectorsUse: "utc",
      localModeVectors:
        "Local-boundary cases are generated under a simulated fixed runtime timezone (UTC for the Phase-1-preserved cases; Asia/Shanghai for the divergence case), noted per case — the host's own zone never leaks into the fixture.",
      aliveRule:
        "The run ends at the latest evidence day; the streak is alive while that day is today or yesterday, otherwise broken → 0. Consecutive = adjacent calendar days in the chosen boundary.",
    },
    notes: [
      "Score lattice: with window 5 and outcomes {1, 0.5, 0}, a full-window score is a multiple of 10, and an exact 79 is unreachable — the 79↔80 threshold edge is covered as just-below (75, four records), at (80), and above-with-rounding (83).",
      "RESOLVED (ticket 01 flagged → ticket 02 amendment): the golden vectors caught the half-up rollup reading 100 while a node was partial — Math.round((100+99)/2) = 99.5 → 100 outweighed the cap at small plan sizes (ticket 01's Comments carried it verbatim as rollup.cap-two-node-tie-reaches-100). ADR-0001 amended 2026-11-04: the rollup mean now FLOORS, so a plan reads 100 only when every node scores 100 (⇔ every node mastered). The tie case is rollup.cap-two-node-tie-floors-below-100 (99), next to rollup.cap-two-unverified-hold-below-100 (99.33… → 99).",
      "Freshness landed (ticket 04, amendment 2026-11-04): category 'decay' pins the freshness cap both directions at the 14-day boundary (exactly-14d fresh certifies; +1s stale caps 99/partial), the mastered→partial drop, cap-not-drift (stale 83 stays 83), the rollup-with-one-decayed-node hold below 100, the gate×freshness max-cap interplay, and the streak's independence. The 33 pre-flight cases inject no 'now' and are value-identical to their pre-decay expectations.",
      "Equal-timestamp tie pinned (review P2-5): node-score.window-tie-equal-createdAt-earlier-insert-ages-out — a window tie breaks by insertion order, the EARLIER-inserted record being the OLDER recency (the TS comparator's V8-observed behavior; Ruby's sort is not stable, so its index tiebreak is explicit — the sides agree by contract, not by coincidence).",
    ],
  };

  return { meta, cases };
}

// ── Self-checks: run before any write; failure exits non-zero, fixture untouched ──

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Known-answer literals from ADR-0001 + the committed corpus — the independent source. */
const KNOWN_ANSWERS: Record<string, string> = {
  "node-score.empty-node-scores-zero-uncovered": "0",
  "node-score.all-wrong-zero-but-partial": "0",
  "node-score.forfeit-window-four-records-just-below-75": "75",
  "node-score.threshold-at-80-mastered": "80",
  "node-score.threshold-above-rounding-83-mastered": "83",
  "node-score.rounding-half-up-tie-38": "38",
  "node-score.gate-edge-two-records-cap-99": "99",
  "node-score.gate-edge-three-records-masters": "100",
  "node-score.single-record-cap-99": "99",
  "node-score.window-edge-six-records-oldest-wrong-ages-out": "100",
  "node-score.window-edge-six-records-oldest-correct-excluded": "80",
  "node-score.window-recency-by-createdAt-not-insertion": "80",
  "node-score.window-tie-equal-createdAt-earlier-insert-ages-out": "80",
  "rollup.empty-plan-scores-zero": "0",
  "rollup.uncovered-node-counts-zero": "50",
  "rollup.rounding-mean-of-scores-83": "83",
  "rollup.all-mastered-exactly-100": "100",
  "rollup.cap-two-node-tie-floors-below-100": "99",
  "rollup.cap-two-unverified-hold-below-100": "99",
  "rollup.single-node-plan-is-node-score": "83",
  "task.empty-task-rollup-zero": "0",
  "task.single-node-rollup-is-node-score": "83",
  "streak.utc.empty-no-evidence-zero": "0",
  "streak.utc.consecutive-days-ending-today-alive": "3",
  "streak.utc.yesterday-alive-today-missing": "1",
  "streak.utc.two-day-gap-broken": "0",
  "streak.utc.same-day-multiple-records-one-day": "1",
  "streak.utc.old-run-behind-gap-ignored": "5",
  "streak.utc.day-straddle-23-59-vs-00-01-two-days": "2",
  "streak.utc.same-utc-day-one-day": "1",
  "streak.local.simulated-utc.consecutive-days-alive": "3",
  "streak.local.simulated-utc.two-day-gap-broken": "0",
  "streak.divergence.utc-mode-counts-two-days": "2",
  "streak.divergence.local-mode-simulated-asia-shanghai-one-day": "1",
  // Freshness/decay matrix (ADR-0001 amendment 2026-11-04, ticket 04) —
  // hand-worked literals: exactly-14d fresh certifies, +1s stale caps 99.
  "decay.boundary-exactly-14-days-fresh-certifies": "100",
  "decay.boundary-14-days-plus-1s-caps-99-partial": "99",
  "decay.mastered-node-decays-to-partial": "99",
  "decay.stale-sub-99-score-unchanged-partial": "83",
  "decay.rollup-one-decayed-node-holds-below-100": "99",
  "decay.gate-cap-and-freshness-cap-both-99": "99",
  "decay.streak-own-rule-ignores-freshness": "0",
};

/** The boundary matrix — the categories and case counts tickets 01 + 04's ACs pin. */
const EXPECTED_INVENTORY: Record<VectorCategory, number> = {
  node_score: 13,
  rollup: 7,
  task_rollup: 2,
  streak: 10,
  streak_divergence: 2,
  decay: 7,
};

function fail(message: string): never {
  console.error(`generate-mastery-vectors: SELF-CHECK FAILED — ${message}`);
  process.exit(1);
}

function selfCheck(doc: FixtureDocument): void {
  const { cases, meta } = doc;

  // Determinism, leg 1: a second in-process build is byte-identical.
  const first = JSON.stringify(doc, null, 2) + "\n";
  const second = JSON.stringify(buildDocument(), null, 2) + "\n";
  if (first !== second) fail("two in-process builds are not byte-identical");

  // Ids: unique + lexicographically sorted (stable-order contract).
  const ids = cases.map((c) => c.id);
  const sorted = [...ids].sort();
  if (ids.length !== new Set(ids).size) fail("duplicate case ids");
  if (ids.some((id, i) => id !== sorted[i])) fail("case ids are not lexicographically sorted");

  // Category inventory: the boundary matrix is complete.
  const counts: Partial<Record<VectorCategory, number>> = {};
  for (const c of cases) counts[c.category] = (counts[c.category] ?? 0) + 1;
  for (const [category, expected] of Object.entries(EXPECTED_INVENTORY)) {
    if (counts[category as VectorCategory] !== expected) {
      fail(`category ${category}: expected ${expected} cases, got ${counts[category as VectorCategory] ?? 0}`);
    }
  }

  // Contract: mastery-derived numerics are strings; timestamps are Z-tagged ISO-8601.
  for (const c of cases) {
    if (!(c.id in KNOWN_ANSWERS)) {
      fail(`case ${c.id} is missing from the known-answer table`);
    }
    const numeric = c.expected.score ?? c.expected.rollup ?? c.expected.streak;
    if (typeof numeric !== "string") fail(`case ${c.id}: expected value is not a string`);
    for (const r of c.input.evidence ?? []) {
      if (!ISO_UTC.test(r.createdAt)) fail(`case ${c.id}: timestamp ${r.createdAt} is not Z-tagged ISO-8601`);
    }
    for (const records of Object.values(c.input.evidenceByNode ?? {})) {
      for (const r of records) {
        if (!ISO_UTC.test(r.createdAt)) fail(`case ${c.id}: timestamp ${r.createdAt} is not Z-tagged ISO-8601`);
      }
    }
    if (c.input.now !== undefined && !ISO_UTC.test(c.input.now)) {
      fail(`case ${c.id}: injected 'now' ${c.input.now} is not Z-tagged ISO-8601`);
    }
    if (c.call === "computeStreak" && !(c.input.now && ISO_UTC.test(c.input.now))) {
      fail(`case ${c.id}: streak 'now' missing or not Z-tagged`);
    }
  }

  // Known answers: ADR-0001 + corpus literals against the generated outputs.
  for (const c of cases) {
    const expected = KNOWN_ANSWERS[c.id];
    const actual = c.expected.score ?? c.expected.rollup ?? c.expected.streak;
    if (actual !== expected) {
      fail(`case ${c.id}: known answer ${expected} (ADR-0001/corpus) but implementation produced ${actual}`);
    }
  }

  // Intermediate-mean cross-check: for non-capped node cases the documented order
  // (round(mean × 100)) must reproduce the black-box score — catches drift between
  // the documented operation order and the implementation's actual one. Covers the
  // decay cases too (the freshness cap is part of the documented order since
  // amendment 2026-11-04): a 99 score against a reproduced 100 is a cap, nothing else.
  for (const c of cases) {
    if (c.call !== "computeNodeScore" || c.expected.meanOfWindowedValues === null) continue;
    const mean = Number(c.expected.meanOfWindowedValues);
    const reproduced = String(Math.round(mean * 100));
    const score = String(c.expected.score);
    const capped = Number(score) === 99 && reproduced === "100";
    if (!capped && reproduced !== score) {
      fail(`case ${c.id}: documented operation order reproduces ${reproduced}, implementation says ${score}`);
    }
  }

  // Provenance pin present.
  if (typeof meta.generatedAtSourceCommit !== "string" || meta.generatedAtSourceCommit.length === 0) {
    fail("meta.generatedAtSourceCommit missing");
  }
}

function main(): void {
  const doc = buildDocument();
  selfCheck(doc);

  const json = JSON.stringify(doc, null, 2) + "\n";

  let existing: string | null = null;
  try {
    existing = readFileSync(FIXTURE_PATH, "utf8");
  } catch {
    existing = null;
  }

  if (existing === json) {
    console.log(`generate-mastery-vectors: fixture unchanged (${doc.cases.length} cases) — ${FIXTURE_PATH}`);
    return;
  }

  mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, json, "utf8");
  const perCategory = doc.cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `generate-mastery-vectors: wrote ${doc.cases.length} cases ` +
      `(${Object.entries(perCategory).map(([k, v]) => `${k} ${v}`).join(", ")}) → ${FIXTURE_PATH}`,
  );
  console.log(`generate-mastery-vectors: source commit ${doc.meta.generatedAtSourceCommit as string}`);
}

main();

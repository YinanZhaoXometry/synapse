# 02: The Ruby `Mastery` module — ADR-0001 verbatim

**What to build:** `app/models/concerns/` or `app/lib/mastery.rb` (placement at ticket time): node score (last-5 windowed mean, weights 1/0.5/0, ≥80 & ≥3 mastered, <3 caps at 99), plan rollup (mean-of-scores, uncovered=0, 100% only all-mastered), task single-node rollup, mastered predicate. RSpec consumes the committed fixtures with exact-equality (BigDecimal vs string decimals).

**Blocked by:** 1 (fixture shape frozen); epic gate: epic-01 done.

**Status:** done

**Bound by:** AD-14 (verbatim port; ambiguities → amend ADR-0001 first, both sides together), AD-6 (no second vocabulary).

- [x] Fixture parity exact across the whole matrix — zero tolerance diffs
- [x] No scoring logic anywhere else in api (grep-guard or convention note in backend/AGENTS.md)
- [x] RuboCop clean

## Comments

Landed 2026-11-04 (a5c5e7d + 7e736e1 + 9bfc2bc). Placement per delta-review item 4: `backend/app/lib/mastery.rb`, a pure module (no Rails, no clock, "now" injected). RSpec consumes the committed fixture with exact string-decimal equality — the fixture IS the acceptance bar.

### STEP 0 first: the flagged rollup-tie finding resolved as ONE change (ADR → TS → fixture)

Ticket 01's vectors exposed that half-up rollup rounding violates ADR-0001's own readiness invariant (`Math.round((100+99)/2) = 100`, and `(n·100−1)/n ≥ 99.5` for every n ≥ 2 — one unverified 99-node displayed a 100% plan). Resolved per AD-14/delta-review item 6 — ADR first, then both sides together, never a quiet divergence:

- **ADR-0001, amendment 2026-11-04 (ticket 02):** the plan rollup mean is now **floored to the whole percent** (`Math.floor`). `(n·100−1)/n` is strictly below 100 for every n, so rollup 100 ⇔ every node scores 100, and node 100 requires the evidence gate — the invariant is arithmetic now, not aspirational. Alternative considered and documented in the ADR: clamping at 99 unless every node is mastered — rejected (an all-mastered special case evaluated at every read + a second rounding rule next to the node-level half-up; the floor is one rule, monotone, no special case). Only rollup means with fractional part ≥ 0.5 move; node-level rounding is unchanged.
- **TS side:** `computePlanRollup` → `Math.floor`. Tests re-derived honestly (never loosened): `(100+100+0)/3` 67 → **66** (mastery.test.ts), `(100+63)/2` 82 → **81** (evidence-loop.integration.test.ts); NEW test pins the floored tie `(100+99)/2` → **99**. Suite 411 → **412** (the amendment landing, +1 test). `quiz-repository.test.ts`'s rollup-99 case is exact `(99+99)/2` → unchanged.
- **Fixture regenerated** (commit order matters: fix commit a5c5e7d first, then regeneration, so `generatedAtSourceCommit` pins the behavior commit). Exactly one case value moves: `rollup.cap-two-node-tie-reaches-100` renamed to **`rollup.cap-two-node-tie-floors-below-100`, 100 → 99** — every other case value byte-identical (12+7+2+10+2 = 33 cases unchanged in shape). `meta.rounding.mode` now states BOTH postures (node half-up / rollup floor); `meta.notes` FLAGGED entry → RESOLVED with the ticket-01 history. Web gates green: tsc ✅ · eslint ✅ (0 errors, 10 pre-existing shadcn warnings) · vitest ✅ 412/55 files · vite build ✅.

### The port (`backend/app/lib/mastery.rb`)

- Node score: last-5 windowed mean by `createdAt` recency (ties keep insertion order), outcome values from `OUTCOME_VALUES` (never hardcoded), ÷ windowed count, ×100, **Math.round semantics** (half toward +∞ — the 37.5→38 tie pin; Ruby `Float#round`'s ties-away-from-zero is identical on these non-negative values), `< 3 total records → min(score, 99)`. Float path mirrors the TS operation order bit-for-bit (naive left-to-right `inject`, not `Array#sum`'s compensated summation).
- Mastered predicate: score ≥ 80 AND ≥ 3 total records; states are the TS strings verbatim (`STATES = ["uncovered", "partial", "mastered"]` — AD-6, no second vocabulary).
- Plan rollup: mean of node scores (uncovered = 0), **floored once** per the STEP-0 amendment; task rollup = exactly the single node's score.
- Streak: **UTC calendar days only** — `day_boundary:` accepts only `:utc` and raises `ArgumentError` otherwise (the pinned contract; a per-user timezone stays a deferred row). Alive while the latest evidence day is today or yesterday; consecutive = adjacent UTC days; v1 is freshness-invariant-free (decay is ticket 04's).
- Constants mirror `MASTERY_CONFIG` and are asserted against `meta.config` in the spec (window 5, gate 3, threshold 80, outcomes 1/0.5/0).

### Fixture parity evidence (the AC bar)

`spec/lib/mastery_spec.rb`: **39 examples, 0 failures** — all 33 fixture cases dispatched by `call`, plus 6 meta/contract examples (config parity, state vocabulary, provenance-pin shape, the 33-case inventory, call dispatch, UTC-only refusal). Exact equality everywhere: scores/rollups/streaks compare `Integer#to_s` against the fixture strings; the float intermediates (`meanOfWindowedValues`) compare shortest-round-trip digits (JS `Number::toString` ≡ Ruby `Float#to_s` for identical IEEE doubles, modulo the integral "1" vs "1.0" spelling, normalized) — `node-score.threshold-above-rounding-83-mastered`'s `"0.8333333333333334"` passes digit-for-digit. The local-boundary streak cases (generated under simulated zones per `meta.streak.localModeVectors`) are reproduced arithmetically: a fixed-offset table maps each local case id to its zone (UTC → +0, Asia/Shanghai → +8) and shifts instants before the UTC engine — an unmapped local case fails loudly (KeyError), never silently degrades to UTC. `generatedAtSourceCommit` = `a5c5e7de…` (the STEP-0 behavior commit), verified full-sha in the spec.

### T03's API — exact module signatures

Records: any Enumerable of objects responding to `#outcome` (String/Symbol from `{correct, partial, wrong}` — `EvidenceRecord` rows qualify as-is) and `#created_at` (Time). All pure; raises on an unknown outcome (closed vocabulary).

```ruby
Mastery::WINDOW # => 5 · Mastery::EVIDENCE_GATE # => 3 · Mastery::MASTERED_THRESHOLD # => 80
Mastery::OUTCOME_VALUES # => {"correct"=>1.0, "partial"=>0.5, "wrong"=>0.0}
Mastery::STATES # => ["uncovered", "partial", "mastered"]
Mastery::UNVERIFIED_CAP # => 99
Mastery::NodeStats   = Struct.new(score:, state:, mean_of_windowed_values:, keyword_init: true)
Mastery::NodeSummary = Struct.new(node_id:, score:, state:, keyword_init: true)

Mastery.node_stats(records)            # -> NodeStats (the mean is the golden-vector float intermediate; nil when uncovered)
Mastery.compute_node_score(records)    # -> Integer 0..100 (half-up at node level; <3 records caps at 99)
Mastery.node_state(records)            # -> "uncovered" | "partial" | "mastered" (String, the TS vocabulary)
Mastery.summarize_nodes({node_id => records, ...}) # -> [NodeSummary] (hash key order)
Mastery.compute_plan_rollup({node_id => records, ...}) # -> Integer (uncovered = 0, floored mean)
Mastery.compute_task_rollup(records)   # -> Integer (the single node's score)
Mastery.compute_streak(records, now: Time, day_boundary: :utc) # -> Integer (raises ArgumentError on any other boundary)
```

Ticket 03 wiring: `KnowledgeNodeType.masteryScore/.state` → load the node's evidence, `compute_node_score`/`node_state`; `StudyPlanType.masteryScore` → per-node evidence hash → `compute_plan_rollup`; root `streak` → all of the user's EvidenceRecords + `Time.now.utc` → `compute_streak`. StudyTask keeps no own field — its node's score IS the task rollup (ADR consequence verbatim).

### Gates

- Web (STEP 0): `tsc -b` ✅ · eslint ✅ 0 errors · vitest ✅ **412 tests / 55 files** (411 baseline + the floored-tie test; two expectations re-derived 67→66, 82→81) · `vite build` ✅
- Backend: rubocop ✅ **227 files, 0 offenses** (225 baseline + mastery.rb + mastery_spec.rb) · rspec ✅ **539 examples, 0 failures** (500 baseline + 39)
- schema.graphql byte-identical (no GraphQL surface change — ticket 3 owns fields); no scoring logic outside `Mastery` (grep-verified; convention note in backend/AGENTS.md).
- `git merge --no-edit epic/p2-4-mastery` after close-out: expect no-op (branch base = integration @ 39352e5).

# 01: Golden-vector generator + committed fixtures

**What to build:** `frontend/scripts/generate-mastery-vectors.ts` (runs via the web toolchain) producing `backend/spec/fixtures/mastery_vectors.json` from `domain/mastery.ts` + the streak rollup: every boundary in both directions (79↔80 score, 2↔3 evidence, window-5 edge, uncovered-node rollup, all-mastered 100, task single-node rollup, 99-cap), decimals as strings, timestamps timezone-tagged, streak day-boundary policy stated (A1: pin in ADR-0001 if Phase 1 left it implicit), rounding mode + operation order recorded in ADR-0001's terms. Deterministic output (sorted, stable keys). CI (web job) regenerates + diffs until the cutover retires the TS side.

**Blocked by:** None (needs only epic-00's layout).

**Status:** done

**Bound by:** AD-14 (fixture contract: strings/timezones/exact-equality), AD-6 (one implementation is the source), ADR-0001 (values).

- [x] Generator runs green via `pnpm` script; fixture committed; regeneration = no diff
- [x] Boundary matrix covers both directions of every threshold; case list reviewed against ADR-0001
- [x] Streak policy stated (ADR amendment if needed — flagged, not smuggled)
- [x] Web test suite count unchanged (a script, not test edits)

## Comments

Landed 2026-11-04 (2fb3caf + 7a6c4b3). **33 cases** in `backend/spec/fixtures/mastery_vectors.json`; regeneration is byte-identical (run twice + in-process double-build assert).

### Flagged first: the 99-cap × rollup-rounding interplay is NOT what the ticket prose assumed

The ticket's matrix asks for "perfect-unverified node holds plan below 100" — the verbatim implementation does **not** always do that: `Math.round((100+99)/2) = Math.round(99.5) = 100` (half-up tie), and `(100+100+99)/3 → 100` too. In fact `(n·100−1)/n ≥ 99.5` for every n ≥ 2, so **any** all-mastered-but-one-unverified plan reads a 100% rollup. The vectors carry it verbatim per delta-review item 6, in both directions:

- `rollup.cap-two-node-tie-reaches-100` → **"100"** while a node is `partial` (the ADR-0001 consequences wording — "100% is reachable only when every node is genuinely mastered" — is violated by the rounding tie)
- `rollup.cap-two-unverified-hold-below-100` → **"99"** (two unverified nodes hold it below)

If the owner wants the prose invariant to actually hold, that is an **ADR-0001 amendment first, then both implementations together** (AD-14) — e.g. clamping the rollup at 99 unless every node is mastered, or round-half-even. Until then the fixture pins the true behavior; T02 must reproduce `100` for that case, not the prose. Also flagged in the fixture's `meta.notes` and in the case's `description`/`note`.

### Fixture shape / contract (for T02)

Top level: `{ meta, cases }` — `cases` sorted lexicographically by `id`, unique, stable keys.

- **`meta.config`** mirrors `MASTERY_CONFIG` verbatim (`window: 5, evidenceGate: 3, masteredThreshold: 80`, `outcomeValues` as strings `"1"/"0.5"/"0"`) — T02 asserts its constants against this.
- **`meta.rounding`**: mode (`ECMAScript Math.round`, half toward +∞; a `x.5` tie rounds UP) + operation order per level (node score: sort newest-first → window 5 → sum → divide by **windowed count** → ×100 → round → `min(·, 99)` if **total** records < 3; rollup: sum scores → divide by node count → round once; task: `computeNodeScore` of the single node).
- **`meta.streak`**: pinned contract is **UTC** (`dayBoundary: "utc"`); alive rule; local-mode vectors are generated under simulated fixed zones (per-case note).
- **`meta.fixtureEncoding`**: every mastery-derived numeric (score/state inputs, rollups, streaks, intermediate means) is a **decimal STRING** — parse on the Ruby side, exact equality, no epsilon. All timestamps are **ISO-8601 Z**. `generatedAtSourceCommit` = last commit touching `mastery.ts`/`streak.ts`/the generator.
- **Case dispatch by `call`**: `computeNodeScore` → `expected { score, state, meanOfWindowedValues }` (mean is the pre-round intermediate for float-parity; `null` for empty); `computePlanRollup` → `{ rollup, nodes: [{ nodeId, score, state }] }` (nodes sorted by id); `computeTaskRollup` → `{ rollup }`; `computeStreak` → `{ streak }`, input carries `now` + `dayBoundary`. Ruby maps outcomes `correct/partial/wrong` → `1/0.5/0` from `meta.config`, never hardcodes weights.

### Case-count matrix (33)

| Category | N | Boundaries covered (both directions where applicable) |
| --- | --- | --- |
| `node_score` | 12 | empty→0/uncovered; all-wrong→0-but-partial (forfeit→0); threshold below-75 / at-80 / above-83 (exact 79 unreachable — lattice note in meta); half-up tie 37.5→**38** (rounding-mode pin); gate 2→99-cap / 3→masters / 1-record 99-cap; window-5 edge: 6 records oldest-wrong ages **out** (100) and oldest-correct **excluded** (80) — a window of 6 would read 83; recency-by-createdAt (shuffled) → 80 |
| `rollup` | 7 | empty plan→0; uncovered-counts-0 → 50; mean rounding → 83; all-mastered → exactly 100; 99-cap tie → **100 (flagged)**; 99-cap holding → 99; single-node plan → node score |
| `task_rollup` | 2 | empty→0; single-node rollup = node score (83) |
| `streak` | 10 | UTC contract: empty 0; 3 consecutive alive; yesterday alive (1); two-day gap broken (0); same-day multiplicity → 1; old-run-behind-gap ignored; **UTC day edge** 23:59Z vs 00:01Z → 2 and same-UTC-day 22:00Z+23:59Z → 1; Phase-1 default (`local`) preserved under simulated UTC (alive 3 / broken 0) |
| `streak_divergence` | 2 | the pinned local-vs-UTC divergence: same instants (Nov 4 18:00Z + Nov 5 02:00Z) count **2** under UTC, **1** under local simulated as Asia/Shanghai (both records local Nov 5) — why the boundary needed pinning |

### Runner chosen (honest toolchain, zero new deps)

`"generate:mastery-vectors": "node scripts/generate-mastery-vectors.ts"` — plain **node 24 native type stripping** (no `tsx`/`vite-node`/`ts-node` dependency added; `tsx` is not a dep and adding it would churn the lockfile). Node 24 runs the script + the imported domain modules directly (their entity imports are type-only and erase). CI gets node 24.22 via `.nvmrc` through `setup-node`; local dev is node 24.1. Node prints an innocuous `ExperimentalWarning: Type Stripping` — cosmetic. The script typechecks via `tsconfig.node.json` (include gained `scripts/`), so `tsc -b` covers the generator under the existing strict node-project settings.

### Determinism & CI anti-drift mechanics

- Host state cannot leak: `TZ` pinned to `UTC` before any Date (module body — domain modules construct Dates only inside functions); `now` always injected (`2026-11-05T21:00:00Z`); the divergence case temporarily simulates `Asia/Shanghai` (no DST) and restores; record ids are per-build sequences.
- `generatedAtSourceCommit` = `git log -1 -- <mastery.ts, streak.ts, generator>` — stable under unrelated commits, so the CI diff fires **only when the pinned behavior moves** (regenerate + commit the fixture then). CI web job got `fetch-depth: 0` because that query needs history beyond a shallow clone.
- CI step (after Build): `pnpm run generate:mastery-vectors` + `git -C .. diff --exit-code -- backend/spec/fixtures/mastery_vectors.json`, commented as anti-drift retiring at cutover (AD-14). Verified locally: generator run twice + exact step replayed → diff empty.
- The generator self-checks (and refuses to write) on: known-answer literals from ADR-0001 + the committed corpus, contract invariants (string numerics, Z timestamps, sorted unique ids, exact category inventory), and in-process double-build byte-identity. TDD red-proof: a scratch mutation of one literal fails with a precise message; an organic red also fired during development (a type-confused cap guard in the self-check itself, caught by `gate-edge-two-records-cap-99`).

### dayBoundary addition note (streak.ts — the only domain edit)

`computeStreak(records, now = new Date(), options?: { dayBoundary?: "local" | "utc" })` — default `"local"` keeps Phase-1 behavior byte-for-byte (existing corpus untouched and green); `"utc"` renders day keys via `toISOString().slice(0, 10)`. Delta-review item 2 implemented as specified. **No vitest tests added for the option** (suite count stays 411/55 per the AC and delta item 3): the default path is covered by the existing corpus, and the `"utc"` path + local/UTC divergence are exercised by the generator's self-checked vectors — T02's RSpec consumes the same vectors on the Ruby side. ADR-0001 carries the dated, flagged amendment (2026-11-04): rounding posture + streak day boundary, per-user timezone a deferred row.

### Gates

- Web (from `frontend/`): `tsc -b` ✅ · `eslint .` ✅ (0 errors; the 10 warnings are the pre-existing shadcn/react-refresh set) · `vitest run` ✅ **411 tests / 55 files — baseline unchanged** · `vite build` ✅
- Backend (data-file-only change on this ticket): rubocop ✅ 225 files, 0 offenses · rspec ✅ **500 examples, 0 failures**
- `git merge --no-edit epic/p2-4-mastery` after close-out: no-op (integration still at 9a18bd7 = this branch's base).

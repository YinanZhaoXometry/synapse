# 03: Score + streak resolver bodies on the wire

**What to build:** implement the `masteryScore`/state + plan-rollup + streak resolver bodies on the GraphQL types epic-03 hosts (KnowledgeNode, StudyPlan, per epic-03 ticket 1's recorded placement decision), backed by the Ruby module; specs build evidence graphs via factories and assert scores move only on evidence (uncovered-never-green, marking-never-moves asserted once more server-side).

**Blocked by:** 2; epic-03's types landed.

**Status:** done

**Bound by:** AD-14 (client renders, never recomputes — this is the only score source), AD-13 (scoping — scores ride user-scoped entities), FR-15 rule (claim ≠ evidence).

- [x] Fields answer over GraphQL against factory evidence graphs, matching fixture expectations
- [x] Marking/claim writes leave scores unchanged (spec)
- [x] Cross-user read of a score-bearing entity blocked by scoping context

## Comments

Landed 2026-11-04 (337ee21 → close-out). Schema movement is exactly the delta-review item-5 fields — `git diff` on `schema.graphql` shows four additions and nothing else: `KnowledgeNode.masteryScore: String!`, `KnowledgeNode.state: String!`, `StudyPlan.masteryScore: String!`, root `Query.streak: Int!`. StudyTask deliberately gains NO field — its single owned node's `masteryScore` IS the task rollup (ADR consequence verbatim; pinned by spec via `task { node { masteryScore state } }`).

### Int vs String — decided: String! (both scores; the task's "fixture contract favors string" lean confirmed)

- The value on the wire is the post-round integer percent (both implementations return integers; the golden vectors pin them as strings). GraphQL `Int` would be honest today — but **every score that crosses a boundary in this repo travels as a string decimal**, per the golden-vector exact-equality contract (ticket 02's spec compares `Integer#to_s` against fixture strings). `String!` keeps the wire value **lexically identical to the fixture value**, so any future client-side anti-drift check (epic-08+) compares without a type conversion, and a server-vs-fixture mismatch is a string diff, not a numeric near-miss.
- Secondarily: the pre-round intermediate is a float, and rounding posture is a *live* ADR concern (ticket 02's STEP-0 tie amendment moved a fixture value). A String wire type can carry a future fractional display without a breaking schema move; `Int` could not.
- `Int` rejected: the honest type for today's value, but it buys nothing the contract needs and would put a type conversion between the wire and the fixture contract.
- Cost, noted for epic-08's client: parse once at the boundary (`Number(masteryScore)`) before ring/percent rendering.

### Field semantics (the epic-08 client contract)

- `KnowledgeNode.masteryScore: String!` — integer percent `"0".."100"`, computed per read by `Mastery.compute_node_score` over that node's evidence (last-5 windowed mean, half-up; `< 3` records caps at 99). `"0"` with no evidence — uncovered never reads green.
- `KnowledgeNode.state: String!` — `Mastery.node_state` verbatim: `"uncovered"` (no evidence) | `"partial"` | `"mastered"` (score ≥ 80 AND ≥ 3 records). A closed string vocabulary, same pattern as `visibility` — NOT a GraphQL enum (AD-6: no second vocabulary).
- `StudyPlan.masteryScore: String!` — the plan rollup: floored mean of all its nodes' scores, **uncovered nodes counting 0**; rollup 100 ⇔ every node mastered (ADR-0001 amendment 2026-11-04; the floored 100+99→99 tie is pinned on the wire).
- `Query.streak: Int!` — the current user's evidence-day streak over ALL their EvidenceRecords: consecutive UTC calendar days ending at the latest evidence day, alive only while that day is today or yesterday (UTC), else 0. No arguments, user-scoped.
- All four are **computed per read, never stored** — no columns, no denormalized state, no cache to invalidate; the schema diff carries no model/migration movement at all.

### Resolver wiring (thin, per AD-12's reads carve-out + AD-6's "no scoring logic outside Mastery")

- `KnowledgeNodeType.mastery_score`/`state` → `object.evidence_records` (the node's own `has_many`, `foreign_key: :node_id`) into `Mastery.compute_node_score`/`node_state`. Scoping rides the association path (the epic-03 reads convention): the node was resolved through the caller's own plan/task path, so its evidence is the caller's.
- `StudyPlanType.mastery_score` → one grouped load (`EvidenceRecord.where(user_id:, node_id: nodes)` → `group_by(&:node_id)`) keyed `{node_id => records}` (uncovered nodes present with `[]` → count 0) into `Mastery.compute_plan_rollup`. Two queries, no N+1.
- `QueryType.streak` → `Mastery.compute_streak(current_user!.evidence_records, now: Time.current)` — `day_boundary` omitted: the module's pinned `:utc` default is the contract (it raises `ArgumentError` on anything else).

### Spec inventory — `spec/requests/graphql_mastery_scores_spec.rb`, 16 examples

- Node fields (7): uncovered → `"0"`/`uncovered` · 5 correct → `"100"`/`mastered` · 4 correct+1 wrong → `"80"`/`mastered` (threshold edge) · 2 correct → `"99"`/`partial` (the gate cap) · correct+correct+partial → `"83"`/`mastered` (the fixture's 83.33…→83 rounding pin) · stale-wrong-outside-window → `"100"` (recency window drops the 6th-oldest) · a task's owned node answers through the same fields (`"100"`/`mastered`). Every expected value is a hand-worked ADR-0001 example, never a recomputation of the code under test.
- Plan rollup (3): no evidence → `"0"` · 100+99+uncovered → `"66"` (uncovered counts zero, floor) · the 100+99 tie → `"99"` (rollup 100 ⇔ all mastered).
- Streak (4): no evidence → 0 · two records same UTC day → 1 · yesterday 23:59Z + today 00:01Z → 2 (the boundary is UTC midnight, `travel_to`-pinned) · latest evidence 2 days back → 0 (broken).
- FR-15 server-side (1): a real `claimSection` write leaves a node/plan/streak snapshot byte-identical and writes zero EvidenceRecords (claim ≠ evidence, asserted end to end).
- Cross-user (1): a foreign plan id answers uniform NOT_FOUND even with score fields selected (second user, real JWT — the scoping context blocks before any score computes; the shared user-scoping roster stays green untouched).

### Gates

- rubocop ✅ **228 files, 0 offenses** (227 baseline + the new spec). rspec ✅ **555 examples, 0 failures** (539 baseline + 16). Schema dump re-verified byte-identical by the suite's own dump spec; diffstat = exactly the 30 added field/description lines.
- Codegen proof: `pnpm run codegen` regenerates `src/types/graphql.ts` with all four fields (`masteryScore: String`, `state: String`, `streak: Int`); `tsc -b` green. **Zero `frontend/` file changes land** (the generated file is gitignored; `git status` clean).
- `git merge --no-edit epic/p2-4-mastery` after close-out: expect no-op (branch base = integration @ a3eefd4).

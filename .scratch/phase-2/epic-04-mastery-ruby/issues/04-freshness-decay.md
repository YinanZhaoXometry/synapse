# 04: Freshness/decay layer — ADR-0001 amendment (separable, may slip)

**What to build:** NFR-8's decay/freshness rule: propose values + rationale as an **ADR-0001 amendment** (docs/adr/ conventions — surface, don't silently pick), extend the vector generator with decay cases, implement in the Ruby module, prove fixture parity. Ships as one change (amendment + vectors + Ruby). If values aren't ready, this ticket slips without holding the epic or the cutover (v1 = no decay, identical to Phase 1).

**Blocked by:** 2.

**Status:** done

**Bound by:** AD-6/14 (values live in ADR-0001, both implementations agree), NFR-8 (decay rule), OQ-9 residual (Phase-2 freshness).

- [x] ADR-0001 amended with values + rationale (dated reversal note per doc conventions)
- [x] Vectors extended (decay boundaries both directions); Ruby parity exact
- [x] Slip path documented: ticket re-gated at epic-09 kickoff (Analytics is the first consumer) — see Comments (the ticket LANDED 2026-11-04, so nothing waits to be re-gated)

## Comments

Landed 2026-11-04 (bdfee40 → close-out). Values per the kickoff delta review's standing delegation (item 1): freshness window = **14 days** on the node's LATEST evidence record, mechanism = the existing cap pattern. Ships as ONE change: ADR amendment → TS domain → golden vectors → Ruby port → wire.

### The amendment (ADR-0001, dated 2026-11-04, ticket 04)

A node whose newest evidence `createdAt` is **strictly more than 14 days old** caps its displayed score at **99** and never reads `mastered`. `MASTERY_CONFIG` gains `freshnessDays: 14`; the windowed-mean math is untouched (the ADR's own deferred note — "layers on top without touching this formula" — is now cashed in). Boundary: exactly 14 days is fresh (certifies); 14 days + 1 second is stale. The cap composes with the <3-evidence gate as the **max of two "display at most 99" caps** (no double penalty), and a decayed node can never score 100, so the T02 invariant — rollup 100 ⇔ every node mastered — survives arithmetically. Rationale: NFR-8's recall cadence + a forgiving rhythm (scores never drift downward; only the 100/mastered seal expires), FR-24 re-queue resurfaces recall before staleness bites. Alternatives recorded in the ADR: percent decay per week (rejected — continuous drift, harder vectors, no Phase-1 anchor) and forgetting-curve models (rejected — YAGNI, no data).

**Injection posture (the one design decision the ticket left open):** the freshness check engages **only where the caller injects `now`** — mirroring how T01's `dayBoundary` default preserved Phase-1 behavior. The api resolvers always inject `Time.current`, so the wire's masteryScore/state semantics include freshness from this amendment on; callers that pass no `now` (every pre-existing TS call site) keep the byte-identical Phase-1 read. Wiring the web UI's own injection is later work — the constraint "no `frontend/` changes beyond mastery.ts + tests + fixture" was honored exactly.

### TS side (`frontend/src/domain/mastery.ts`)

`computeNodeScore/getNodeState/summarizeNodes/computePlanRollup/computeTaskRollup` all gain an optional trailing `now?: Date | string`. Cap: `gated || stale ? Math.min(raw, 99) : raw`; mastered ⇔ score ≥ 80 AND ≥ 3 records AND fresh. `MASTERY_CONFIG.freshnessDays = 14`. Tests: **9 new freshness examples** (both boundary directions, mastered→partial drop, cap-not-drift at 83, latest-record renewal, rollup hold below 100, gate×freshness max-cap, the no-`now` Phase-1 posture, rollup/summary pass-through) — **zero existing expectations changed** (the default posture keeps them true by construction). Suite 412 → **421** (55 files).

### Golden vectors (40 cases)

Generator gains category `decay` (7 cases, all injecting `input.now`; the 33 pre-flight cases pass no `now` and are **byte-identical value-for-value** — verified by diffing old-vs-new case payloads). Inventory: `node_score` 12 · `rollup` 7 · `task_rollup` 2 · `streak` 10 · `streak_divergence` 2 · **`decay` 7**. Known-answer literals are hand-worked; regeneration is byte-identical (double-run + in-process double-build; sha1 stable).

Exact decay inventory:

| id | call | now | expected |
| --- | --- | --- | --- |
| `decay.boundary-exactly-14-days-fresh-certifies` | computeNodeScore | 2026-11-19T10:00:00Z | "100" / mastered (fresh side of the boundary) |
| `decay.boundary-14-days-plus-1s-caps-99-partial` | computeNodeScore | 2026-11-19T10:00:01Z | "99" / partial (stale side, same evidence) |
| `decay.mastered-node-decays-to-partial` | computeNodeScore | +1s | "99" / partial (the 100/mastered seal expires) |
| `decay.stale-sub-99-score-unchanged-partial` | computeNodeScore | +1s | "83" / partial (cap, not drift) |
| `decay.rollup-one-decayed-node-holds-below-100` | computePlanRollup | +1s | rollup "99" (floor(199/2); fresh node 100 exactly-14d×, decayed 99) |
| `decay.gate-cap-and-freshness-cap-both-99` | computeNodeScore | +1s | "99" / partial (both caps = max cap, no double penalty) |
| `decay.streak-own-rule-ignores-freshness` | computeStreak | +1s | "0" (the streak's OWN two-day rule; decay adds nothing) |

(`×` — the rollup's fresh node's latest record is 2026-11-08, i.e. 11 days inside the window at the traveled now; the pinned exactly-14d node boundary lives in the two boundary cases.)

### Ruby parity (`backend/app/lib/mastery.rb`)

`FRESHNESS_DAYS = 14` (+ `SECONDS_PER_DAY`), `node_stats/compute_node_score/node_state/summarize_nodes/compute_plan_rollup/compute_task_rollup` all accept `now: nil`; `freshness_expired?` = strictly-greater on `now - latest(created_at)`; `state_for` withholds mastered when stale. `spec/lib/mastery_spec.rb`: meta config parity extended (`FRESHNESS_DAYS` ⇔ `meta.config.freshnessDays`), inventory test now 40/6 categories, a new decay describe dispatches the 7 cases by `call` (with `now:` from `input.now`), plus an explicit "never applies freshness without an injected now" pin (stale evidence with no `now` still reads 100/mastered — the Phase-1 posture stays reachable). **47 examples, 0 failures** — every decay case exact-equality green, including the float intermediate (`0.8333333333333334`) digit-for-digit.

### The wire

`KnowledgeNodeType#mastery_score/#state` and `StudyPlanType#mastery_score` now pass `now: Time.current` — the schema does NOT move (`backend/schema.graphql` byte-identical; field descriptions deliberately untouched since they're part of the dump; refreshing their wording rides the next schema-touching ticket). `spec/requests/graphql_mastery_scores_spec.rb` 16 → **19 examples**: fresh boundary (latest evidence exactly 14d → "100"/mastered), stale boundary (14d+1s → "99"/partial via `travel_to`), rollup-with-one-decayed-node ("99" < 100). Because freshness is live on the wire, the pre-existing fixed-timestamp specs became time bombs — every score-reading describe now pins the clock with a describe-level `travel_to(Time.utc(2026,11,4,12,0,0))` (Rails 8 forbids nested block `travel_to`, so the pin is per-describe; the freshness examples travel to Nov 19 with their login INSIDE the travel block — the JWT `exp` is minted relative to now and a token minted at the real clock dies under the 15-day travel).

### Gates (all four, from the worktree)

- Frontend: `tsc -b` ✅ · `eslint .` ✅ (0 errors; the 10 warnings are the pre-existing shadcn/react-refresh set) · `vitest run` ✅ **421 tests / 55 files** (412 + 9) · `vite build` ✅. No codegen movement (schema untouched); one tooling note: `tsconfig.app.tsbuildinfo` self-healed — the committed copy referenced the gitignored `src/types/graphql.ts` (T03's codegen residue); a fresh `tsc -b` without codegen drops it (policy A6).
- Backend: rubocop ✅ **228 files, 0 offenses** · rspec ✅ **566 examples, 0 failures** (555 baseline + 8 mastery_spec + 3 wire).
- `git merge --no-edit epic/p2-4-mastery` after close-out: no-op ("Already up to date", branch base = integration @ ac0dcf4).

### Epic-09 re-gate note

The ticket's slip path (v1 = no decay, re-gate at epic-09 kickoff) is moot: the layer landed 2026-11-04, before the cutover. Epic-09 (Analytics, the first consumer) inherits freshness semantics as-is — decayed nodes read ≤99/partial on the wire already, and re-tuning the window is one config line (`freshnessDays`) on both sides via `meta.config`. Nothing to re-gate; if epic-09 wants a different window or a UI-side injection posture, that is an ADR-0001 amendment first, then both sides together (AD-14), same as this ticket did.

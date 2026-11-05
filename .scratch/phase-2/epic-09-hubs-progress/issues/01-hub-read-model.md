# 01: Hub read model — the api aggregation queries

**What to build:** the GraphQL aggregation surface: mistakes grouped by plan/task (source location + user answer), Today assembly (due items via epic-07 + manual tasks + suggestion slot), flashcard/quiz histories per plan/task, analytics series (per-node mastery, weekly accuracy trend, study consistency), weekly-goal progress (evidence-producing sessions per ISO week), badge-state computation (12-badge taxonomy, thresholds from delta-grill). All server-side, all behind the scoping context.

**Blocked by:** None (epic gate: 07+08 done).

**Status:** done (2026-11-05 — merged to `epic/p2-09-hubs`; gates: rspec 1024 / rubocop clean / frontend untouched green)

**Bound by:** AD-14 (rollups server-side; client renders), AD-13 (scoping — every field), AD-6 (series consume the one mastery source), SM-C3 (sessions, never minutes).

- [x] All aggregations answer on factory graphs; week/day boundaries Timecop-tested
- [x] Scoping context green on every new field; schema + codegen green
- [x] Threshold/heuristic decisions recorded in `## Comments` for T3/T6

## Comments

Implementation landed 2026-11-05 (branch `epic/p2-09-t01-readmodel` @ 94b067f + one commit): the
aggregation logic lives in `backend/app/lib/hubs.rb` (`Hubs` — the read-model module, the Mastery
caller for every score/state, `now` always injected); the seven queries + `setWeeklyGoal` are thin
resolvers over it; `backend/schema.graphql` re-dumped (7 queries, 1 mutation, 14 new types, +518
lines); auth_surface roster grew `setWeeklyGoal`; full suite 1024 examples green, rubocop clean.

**Badge thresholds → T6 (delta decision 1, pinned in `Hubs::THRESHOLDS` with reasons).** All
computed on read per the spec posture — eventual consistency is the recorded tradeoff (no badge
unlocks are persisted; a re-read recomputes). b1 = any quiz session exists (threshold 1) — active
or abandoned sessions count too (a session IS a quiz taken). b2/b3 = `Mastery.compute_streak ≥ 3 /
≥ 7` — the streak's own UTC-day semantics are the badge's; a broken streak un-unlocks (read-time
recompute). b4 = ≥10 flashcards across the caller's decks — COLLECTION badge: no review-event
tracking exists server-side (flashcard flips/ratings never create EvidenceRecords by design), so
"studied flashcards" is NOT measurable; recorded honestly instead of inventing a proxy. b5 = ≥100
evidence records. b6 = ≥5 evidence records whose node carries ≥1 mistake entry — 复盘 read as
"re-answered on a mistake node" because MistakeEntry has no resolved/reviewed flag (epic-10's
recorded delta amendment); when that flag lands, this badge is the one to re-derive. b7/b8/b9 =
1/3/5 DISTINCT nodes with `state == "mastered"` (freshness-engaged) — the scaffold's
subject-specific tiers generalized. b10 = max DISTINCT evidence-producing sessions in ONE UTC day
≥ 3 (SM-C3: sessions, never minutes — same counter drives `consistency`). b11 = ≥1 plan where
every node reads mastered (plans with ZERO nodes never qualify — `nodes.any?` guards the vacuous
all?). b12 = any node reading exactly score 100 (freshness cap makes 100 reachable only past the
evidence gate). Wire shape: `{ id: "b1".."b12", unlocked, counter, threshold }` — **progressLabel
("3/5 nodes" strings, i18n) is T6's**; the badge ids' zh/en description strings already live in
the scaffold's i18n-dictionary.

**Today suggestion v1 → T3 (delta decision 2).** `todayHub.suggestions` = one card per plan with
≥1 node NOT reading `mastered` AND ≥1 CONFIRMED material-node mapping joined through the plan's
nodes (`Hubs.mapped_section?` — the exact plan-scope join `planNodeMappings` uses, status filtered
to confirmed; proposed/rejected rows never qualify). The card names the weakest node by server
score (Mastery's node stats, freshness engaged); **ties break to the lowest `order`** (then
creation order via the nodes' sort). The client renders planTitle + nodeTitle and deep-links
`/plan/:id/quiz?nodeId=` — no new AI surface (AD-16). Manual tasks: `manual` lists OPEN tasks only
(done=false), ordered `due_date ASC NULLS LAST, created_at, id`; `summary.doneCount` counts done
manual tasks with NO date window — ManualTask has no done-at timestamp, so an honest day-scoping
of "done" does not exist at this layer (if T3 needs "done today", the toggle op should add that
column). `summary.dueCount`/`manualCount` mirror the hub's own lists. Due slice = epic-07's due
logic verbatim (same relation + `DueItemType`), date argument collapsed to now.

**Weekly goal → T5 (delta decision 3).** `weeklyGoal.currentWeekSessions` counts DISTINCT
`evidence_records.session_id` in the current ISO week (Mon 00:00 UTC .. now); sessionless evidence
(non-quiz attributions) and multi-record sessions count once; a session with evidence straddling
the week boundary counts once per window it landed in. `setWeeklyGoal` validates 1..21
server-side (`Progress::WEEKLY_GOAL_MIN/MAX`) — the DB check `users_weekly_goal_target_check` is
the second pin; it is a plain setter (last write wins, no replay semantics). The Dashboard ring
consumes `weeklyGoal` + `analyticsSeries.consistency` — both session-counted (SM-C3).

**Analytics series → T5.** `analyticsSeries.weeklyAccuracy` = the last 8 ISO weeks INCLUDING the
current one, weeks with zero evidence omitted, oldest first; `weekStart` is the ISO Monday as a
UTC day key ("YYYY-MM-DD" — Mastery's `utc_day_key` convention; the module's day-key math is
private, replicated + cited). `consistency` = the last 14 UTC days INCLUDING today, all days
answered (zeros included — a quiet day is still a day), counting DISTINCT evidence-producing
sessions per day. `nodeMastery` = every node of the caller's (plan + task nodes; task nodes ride
with `planId: null`), `masteryScore` as the String-carrying-percent convention.

**Quiz history → T4.** `scoreSummary` follows the quiz results' own correctness definition (one
EvidenceRecord per ANSWERED question — `RecordEvidenceCommand`): `correct` = graded-correct
count, `total` = graded-answered count; open unanswered/awaiting questions ride `questionCount`
only. Every session lists (abandoned/active at zero graded answers — honest history); ordering
newest-first `(created_at desc, id desc)`. `mistakesHub` is the flat newest-first list — T2 owns
grouping/filtering over it. `flashcardDecksHub.createdAt` = the deck MATERIAL's timestamp
(the deck's own creation moment); rows ordered by it.
- **Two-axis review (2026-11-05, inline):** PASS/PASS — resolvers all pass `current_user!` into the pure `Hubs` module (user + injected now, Timecop-tested boundaries, ISO Mon-UTC + streak's day-key convention cited); two-user scoping proof in the request spec; due logic VERBATIM reuse (same relation + DueItemType); weekly_goal via command with server-side 1..21. Deviations recorded in Comments (full delta-2 suggestion condition; doneCount un-windowed honest).

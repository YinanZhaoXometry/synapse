# 01: Hub read model — the api aggregation queries

**What to build:** the GraphQL aggregation surface: mistakes grouped by plan/task (source location + user answer), Today assembly (due items via epic-07 + manual tasks + suggestion slot), flashcard/quiz histories per plan/task, analytics series (per-node mastery, weekly accuracy trend, study consistency), weekly-goal progress (evidence-producing sessions per ISO week), badge-state computation (12-badge taxonomy, thresholds from delta-grill). All server-side, all behind the scoping context.

**Blocked by:** None (epic gate: 07+08 done).

**Status:** ready-for-agent (delta-grill: badge thresholds, suggestion heuristic v1)

**Bound by:** AD-14 (rollups server-side; client renders), AD-13 (scoping — every field), AD-6 (series consume the one mastery source), SM-C3 (sessions, never minutes).

- [ ] All aggregations answer on factory graphs; week/day boundaries Timecop-tested
- [ ] Scoping context green on every new field; schema + codegen green
- [ ] Threshold/heuristic decisions recorded in `## Comments` for T3/T6

# 08: Backend N+1 guards — one shared query-count helper, four guarded read shapes

**What to build:** promote the hand-rolled query counter (written twice inline:
graphql_square_spec.rb:223-258, graphql_mastery_scores_spec.rb:131-146) into
`spec/support/query_count.rb` (`expect_query_count(n) { ... }` over an ActiveSupport::Notifications
SELECT subscription), retrofit both existing uses, and point it at the two unguarded shapes the
audit flagged: `planNodeMappings` (its own spec file documents the eager-N+1 motivation at 30+
nodes but asserts nothing) and the `plans` list. The square and mastery numbers must not move —
the refactor is behavior-neutral.

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** the existing two counters' semantics (SELECT-only count; fixed upper bounds like
≤3 rather than brittle equality on totals, unless a use already asserts equality); no bullet gem
(epic decision 1 — the helper is the guard).

- [x] `spec/support/query_count.rb` helper (count_selects + count_loads_of)
- [x] graphql_square_spec + graphql_mastery_scores_spec refactored onto the helper (same asserted numbers)
- [x] graphql_plan_node_mappings_spec: query count pinned as the plan grows 3 → 9 nodes (bounded ≤3, growth-invariant)
- [x] graphql_plans_spec: list-shape query count guarded as plans grow 1 → 5
- [x] rubocop + rspec green (1348/0; 465 files clean)

## Comments

- Helper shape: `count_selects { request }` (the square pattern) and
  `count_loads_of(:evidence_record) { request }` (the mastery pattern — the name is
  `classify`d to Rails's `"EvidenceRecord Load"` payload form, first draft missed that and
  counted zero). Warm-ups stay caller-side (schema-cache chatter out of the measurement), the
  same semantics both retired inline versions had.
- Retrofits are behavior-neutral: square keeps ≤3 + growth-equality; mastery keeps the
  single-execution `EvidenceRecord Load == 1` (the result is captured inside the counted block,
  not re-executed).
- New guards: planNodeMappings grows 3 → 9 nodes with confirmed rows — count stays ≤3 and
  invariant (the file's own documented eager-N+1 risk is now fenced); plans list grows 1 → 5 —
  count stays ≤3 and invariant.
- Suite 1346 → 1348 examples (+2 guards), 0 failures.

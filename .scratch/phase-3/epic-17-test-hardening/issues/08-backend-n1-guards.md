# 08: Backend N+1 guards — one shared query-count helper, four guarded read shapes

**What to build:** promote the hand-rolled query counter (written twice inline:
graphql_square_spec.rb:223-258, graphql_mastery_scores_spec.rb:131-146) into
`spec/support/query_count.rb` (`expect_query_count(n) { ... }` over an ActiveSupport::Notifications
SELECT subscription), retrofit both existing uses, and point it at the two unguarded shapes the
audit flagged: `planNodeMappings` (its own spec file documents the eager-N+1 motivation at 30+
nodes but asserts nothing) and the `plans` list. The square and mastery numbers must not move —
the refactor is behavior-neutral.

**Blocked by:** —.

**Status:** ready-for-agent

**Bound by:** the existing two counters' semantics (SELECT-only count; fixed upper bounds like
≤3 rather than brittle equality on totals, unless a use already asserts equality); no bullet gem
(epic decision 1 — the helper is the guard).

- [ ] `spec/support/query_count.rb` helper (+ inline sanity in its first consumer)
- [ ] graphql_square_spec + graphql_mastery_scores_spec refactored onto the helper (same asserted numbers)
- [ ] graphql_plan_node_mappings_spec: query count pinned at a realistic node count (bounded, documented)
- [ ] graphql_plans_spec: list-shape query count guarded as plans grow
- [ ] rubocop + rspec green

## Comments

- (none yet)

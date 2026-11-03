# 05: Cross-aggregate integration walk + schema review

**What to build:** one RSpec walk executing the Phase-1 happy path purely as GraphQL ops — register (epic-02) → create plan via proposal confirm → attach material (client-extracted payload) → persist quiz session (node-attributed) → record grades → read plan detail — asserting the aggregate reads reflect the writes; then the schema review: `schema.graphql` re-dump idempotent, growth diffed against the ticket set (nothing extra), web `pnpm codegen` emits clean types.

**Blocked by:** 3, 4.

**Status:** ready-for-agent

**Bound by:** AD-12 (contract review), AD-17 (schema.graphql is THE contract; codegen consumes it), AD-10 (the walk is the integration seam).

- [ ] The walk spec passes against factories, twice in a row (idempotency evidence)
- [ ] Schema diff = exactly the ops from tickets 1–4 (+ epic-02 auth); no stray surface
- [ ] `pnpm codegen` in web green against the new schema
- [ ] rubocop + rspec green; epic closes with the dev-loop note (just up → walk spec) in `api/AGENTS.md`

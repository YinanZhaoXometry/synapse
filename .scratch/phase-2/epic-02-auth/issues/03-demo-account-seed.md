# 03: Idempotent demo-account seed

**What to build:** `db/seeds.rb` (rerun-safe) creating the **demo user** from ENV (`DEMO_EMAIL`/`DEMO_PASSWORD`) plus a small shape-stub dataset owned by that user (one plan + a node or two — demo garnish only; real demo content is seeded closer to the graded window per AD-20). `.env.example` documents the values.

**Blocked by:** 01.

**Status:** ready-for-agent

**Bound by:** AD-15 (seeded demo account = NFR-6's post-login story), AD-13 (seed rows are user-scoped like any other).

- [ ] Seed runs twice → no duplicates (idempotent by stable uuids/email)
- [ ] Demo user can log in via the ticket-02 mutations
- [ ] `.env.example` + compose carry the demo ENV values
- [ ] RuboCop clean; seeds covered by one RSpec smoke

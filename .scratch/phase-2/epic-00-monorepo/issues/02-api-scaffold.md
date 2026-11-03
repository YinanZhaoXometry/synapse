# 02: Minimal bootable Rails api under `api/` — health query, committed contract, gates green

**What to build:** `api/` exists as a *minimal, bootable* Rails 8.1 API-only app: `just up`-style compose (postgres 17 + api) boots it, one GraphQL health query answers over HTTP, the api-committed `schema.graphql` contract exists, and RuboCop + RSpec are green. No business commands, no models, no auth, no AI, no Solid Queue — every future backend epic starts from this green base instead of from scaffolding.

**Blocked by:** None (can start immediately; independent of ticket 01).

**Status:** done 2026-11-03 — afbcfc3..6a905fe + review fixes f7d610f..96eb1ea, merged into epic/p2-0-monorepo (main merge post-Nov-6)

**Bound by:** AD-12 (thin GraphQL layer over a command core — conventions *documented* now, exercised later), AD-17 (compose dev DX, committed schema contract, `api/AGENTS.md` pattern), AD-19 (jobs posture documented, gem deferred — A9), AD-20 (dev envelope).

- [x] Rails 8.1 API-only (≥ 8.1.4 per spine verification 2026-11-03), puma, pg, graphql-ruby 2.5.x, rspec-rails + factory_bot_rails + rubocop + strong_migrations — gems pinned per the spine stack table
- [x] `.dockerdev/compose.yaml` with postgres 17 + the api service; the api runs in containers only (local Ruby version irrelevant)
- [x] Exactly one health query; it answers ok over HTTP from a fresh `compose up`
- [x] `schema.graphql` dumped and committed; a re-dump produces no diff (idempotent contract)
- [x] Colocated RSpec green (health + schema idempotency specs — the scaffold's seed of the colocated-spec convention); RuboCop clean
- [x] Scope guard: `git diff` shows no commands/, models/, auth, AI adapter, ActiveStorage, or Solid Queue code

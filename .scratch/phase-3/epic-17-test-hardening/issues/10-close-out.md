# 10: Close-out — dead code removed, FORBIDDEN reserved, coverage floors ratcheted, docs synced

**What to build:** the epic's tail. Delete `app/graphql/resolvers/base_resolver.rb` (six lines,
zero references anywhere — pure surface area). Mark FORBIDDEN reserved in
`app/commands/application_errors.rb` (+ one line in `application_errors_spec.rb`'s closed-enum
pin) — no behavior change, no frontend errors.ts churn. Raise both coverage floors from
measured−2 to the numbers this PR's CI actually recorded (backend line floor; a frontend
`coverage.thresholds` block with the measured floor). Sync docs: AGENTS.md Commands/CI lines
reflect `--coverage` and the e2e job; roadmap.md board row flips to done. Write the session memory.

**Blocked by:** 1–9.

**Status:** done (2026-11-06)

**Bound by:** closed error enum contract (AD-12 + the frontend errors.ts mirror) — comment-only
touch; `schema_dump_spec` byte-identity must stay green after the resolver deletion (it will —
the resolver is unused — but the gate must prove it).

- [x] base_resolver.rb deleted; schema byte-identity + auth surface green (the wire provably unchanged)
- [x] FORBIDDEN reserved comment in application_errors.rb + application_errors_spec note
- [x] Backend floor ratcheted 95 → 96 (measured 98.31 line / 91.35 branch at close); frontend
      `coverage.thresholds` added — lines 65 / branches 83 / functions 77 (measured 67.65 / 85.4 /
      79.93), each two points under
- [x] AGENTS.md (Commands + CI bullet + tests paragraph) and roadmap.md board synced (done across 02/04/05)
- [x] All 10 tickets `done`; epic.md status flipped; memory written
- [x] Final gate check: full backend rspec 1348/0 + rubocop clean; web tsc/eslint/vitest 854/0;
      `just e2e` 15 passed exit 0; PR CI verdict lands on this branch's run

## Comments

- **Epic close numbers:** rspec 1290 → **1348 examples** (line coverage 97.9 → 98.31, branch
  89.4 → 91.35, floor 96) · vitest 836 → **854 tests** (lines 66.58 → 67.65, thresholds 65/83/77)
  · 74/74 GraphQL ops wire-covered · 15-spec e2e suite now a merge gate · random-order RSpec with
  seed repro · full-dictionary i18n parity enforced · zero new test gems beyond simplecov +
  @vitest/coverage-v8 (epic decision 1 held).
- The resolver deletion was provably inert: `schema_dump_spec` (byte-identity) and
  `auth_surface_spec` (the 41-mutation roster) stay green — the file never touched the wire.

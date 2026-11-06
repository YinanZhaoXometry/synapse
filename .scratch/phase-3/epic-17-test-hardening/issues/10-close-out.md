# 10: Close-out — dead code removed, FORBIDDEN reserved, coverage floors ratcheted, docs synced

**What to build:** the epic's tail. Delete `app/graphql/resolvers/base_resolver.rb` (six lines,
zero references anywhere — pure surface area). Mark FORBIDDEN reserved in
`app/commands/application_errors.rb` (+ one line in `application_errors_spec.rb`'s closed-enum
pin) — no behavior change, no frontend errors.ts churn. Raise both coverage floors from
measured−2 to the numbers this PR's CI actually recorded (backend line floor; a frontend
`coverage.thresholds` block with the measured floor). Sync docs: AGENTS.md Commands/CI lines
reflect `--coverage` and the e2e job; roadmap.md board row flips to done. Write the session memory.

**Blocked by:** 1–9.

**Status:** ready-for-agent

**Bound by:** closed error enum contract (AD-12 + the frontend errors.ts mirror) — comment-only
touch; `schema_dump_spec` byte-identity must stay green after the resolver deletion (it will —
the resolver is unused — but the gate must prove it).

- [ ] base_resolver.rb deleted; full backend gates green (schema byte-identity proves no wire change)
- [ ] FORBIDDEN reserved comment in application_errors.rb + application_errors_spec note
- [ ] Backend floor ratcheted to CI-measured value; frontend `coverage.thresholds` added with measured floor
- [ ] AGENTS.md (Commands + CI bullet) and roadmap.md board synced
- [ ] All 10 tickets `done`; epic.md status flipped; memory written
- [ ] Final triple-gate check: `just spec` green locally + PR CI (frontend/backend/e2e) green

## Comments

- (none yet)

# Epic 2 (Phase 2) — Accounts: email+password JWT, current_user context, demo seed

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epic-01 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane A · spine **AD-15** (bcrypt + JWT bearer, ~24h TTL, no refresh/denylist v1, demo seed, client-side logout), AD-12/13 (commands + scoping) · FR-30 (email+password half), FR-4 · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-users-credentials.md](issues/01-users-credentials.md) | — | bcrypt credentials, JWT encode/decode (~24h, `JWT_SECRET`), command-level login/register |
| 2 | [02-auth-context-mutations.md](issues/02-auth-context-mutations.md) | 01 | `register`/`login` mutations, GraphQL `current_user` context, login rate limit |
| 3 | [03-demo-account-seed.md](issues/03-demo-account-seed.md) | 01 | idempotent ENV-driven demo seed (demo user + shape-stub dataset) |

## Definition of done

Register/login answer over GraphQL with a bearer token the context resolves · `UNAUTHORIZED` on absent/invalid token · rate limit trips · demo seed rerun-safe · scoping context re-proven with a JWT-backed user · rubocop+rspec green · every ticket cites AD ids.

## Coordination notes

- **Gate: epic-01 done.** Runs parallel with epics 04/06 (lanes B/C).
- Epic-03's command-level tickets may start on this epic's branch once ticket 1's users shape is stable (roadmap fine-grained overlap) — coordinate, don't race migrations.
- No logout mutation by design (client-side discard — epic-08). Google OAuth + password reset are deferred-table rows, epic-14's registry.

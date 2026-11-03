# Spec: Epic 2 (Phase 2) — Accounts: email+password JWT, current_user context, demo seed

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final AD-15;
> no open product questions. Gate: epic-01 done. Runs as lane A while 04/06 run lanes B/C.

## Problem Statement

Every server capability is user-scoped (AD-13) but nothing establishes *who the user is*: no credentials, no token, no `current_user` in GraphQL context — epic-03's operations and epic-05's SSE tickets are uncallable without it. AD-15 also pins choices the build must not re-derive: JWT bearer over cookies (cross-origin CF Pages ↔ Render), ~24h stateless TTL, no refresh/revocation v1, no password reset v1, login rate-limited, and a seeded demo account as NFR-6's post-login story.

## Solution

1. **Credentials:** `has_secure_password` + bcrypt on the users table; JWT encode/decode (`JWT_SECRET` ENV, ~24h TTL); login attempts rate-limited.
2. **GraphQL surface:** `register` + `login` mutations returning `{ token, user }`; logout stays client-side (discard token + reset cache + kill SSE — epic-08's half) so **no logout mutation exists**; GraphQL context resolves `current_user` from the Authorization bearer token and is `UNAUTHORIZED` when absent/invalid for any op that needs it.
3. **Demo account:** a seed (idempotent, ENV-driven email/password) creating the pre-seeded demo user NFR-6 relies on; seeded alongside a small demo dataset shape-stub for the graded demo.

Google OAuth is **out of scope** (deferred row: a real user asks for it). Password reset is **out of scope** (mail-gated, epic-14).

## User Stories

1. As a new user, I can register with email + password and receive a JWT.
2. As a returning user, I can log in and receive a JWT valid ~24h, and see a rate-limit error when hammering login.
3. As every later command, I receive `current_user` from GraphQL context — never trust client-supplied identity.
4. As the graded demo, a seeded demo account exists so the post-login surface is demonstrable without signup friction (NFR-6).
5. As epic-08 (cutover), login/register mutations exist exactly once so the login wall wires to them.

## Implementation Decisions

- **Bearer JWT, not cookies** (AD-15, cross-origin); token carries `sub` = user uuid + `exp`; no denylist — accepted risk, recorded.
- **Rate limiting at the mutation/command boundary** (login only, v1): simple per-window counter — exact mechanism (in-memory vs table) chosen at ticket time under "green, no flakiness"; value in config.
- Register enforces email shape + password minimum; duplicates → `VALIDATION_FAILED`.
- Wrong credentials → `UNAUTHORIZED` (never reveal which half was wrong).
- Context: one `current_user` memoized resolver shared by GraphQL and (epic-05) the SSE ticket minter.

## Testing Decisions

- RSpec: register/login happy + failure paths, token expiry boundary, rate-limit trip, context resolution (valid/absent/garbage token), demo seed idempotency.
- The epic-01 scoping context now runs with a real JWT-backed user in at least one spec (proves the wiring end to end).
- Gates: rubocop + rspec; `schema.graphql` grows by exactly register/login.

## Out of Scope

Google OAuth · password reset + SMTP (epic-14 gate) · token refresh/revocation · first-login import (epic-08) · any web surface (epic-08) · session/logout server state.

## Further Notes

- Assumption A1: demo seed lives in `db/seeds.rb` behind ENV values, rerun-safe.
- Assumption A2: rate-limit storage is api-local (no Redis — AD-19 posture); if the free Render restarts flush it, that is accepted v1 risk.

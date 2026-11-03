# Spec: Epic 8 (Phase 2) — The cutover: Apollo, login wall, import, SSE client, retirement, deploy

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> AD-18/15/20/16/14 (web halves). Gate: epics 02+03+04+05+06 **all done** — this is the merge point;
> single integration branch, two-axis review, rollback rehearsal. Owner-side provisioning (Render,
> Neon, R2 values) should already be in hand (roadmap owner table).

## Problem Statement

The server is complete but dark: the web app still runs the static architecture (TanStack + localStorage repositories + simulated AI + anonymous mode). AD-18/15 pin the switch: Apollo Client 4's normalized cache becomes the single client-side owner; the login wall ends the anonymous era; the first-login import carries `synapse-db:v1` over idempotently; the CompanionService swaps to the server adapter behind the unchanged seam; every auth change resets cache + kills SSE; the deployment envelope (CF Pages + Render + Neon + R2) goes live with a rehearsed rollback.

## Solution — six tickets, one integration branch

1. **Apollo swap (T1):** Apollo Client 4 + graphql-codegen typed hooks replace TanStack Query + the repository layer; features consume typed hooks; **cache reset on any auth change** (login/logout/account switch); UI-pref keys (`synapse-lang`, theme) keep their localStorage roles; TanStack mounts retire.
2. **Login wall (T2):** `/login` + `/register` pages (bilingual, AD-9), token storage + Authorization wiring, route guard (pre-login surface stays the fully-static Cloudflare build — NFR-6), demo-account entry; logout = discard token + reset Apollo cache + terminate live SSE.
3. **First-login import (T3):** one-time offer reading `synapse-db:v1` → whole-document upload as **one idempotent mutation** (client-supplied uuids; id-different-owner → `VALIDATION_FAILED`, same-user conflicts skipped, retry safe); then the re-attach invite: original files re-upload via epic-06 presign matched by id; PDFs never re-attached render text-only; **the local document is never deleted** (rollback substrate).
4. **SSE client (T4):** the `src/ai` server adapter's stream half — EventSource wrapper with **auto-reconnect disabled**: on drop, mint a fresh ticket and **restart** the generation (cap-counted; UI notice), terminal errors map `code → AppError → t()`, language parameter follows the UI toggle.
5. **AI seam swap (T5):** CompanionService server implementation (chat + proposal streams via T4; quiz/flashcard/grading via mutations) behind the unchanged `src/ai` interface; the simulated implementation survives as the **dev/test double** (deterministic tests keep running without a server); the closed error code ↔ `AppError.code` mapping table lands web-side (1:1 with the api enum); goal-selection step feeds plan generation ([Phase 2] FR-1 note).
6. **Deploy + rollback rehearsal (T6):** Render docker service (single web process; Solid Queue in-process if epic-07's T1 landed), Neon Postgres 17, CORS = web origin, ENV values, demo seed, CF Pages untouched for the pre-login build; **rollback rehearsal**: redeploy the last pre-cutover commit on Pages, verify the anonymous build resumes from the still-present `synapse-db:v1`, server work abandoned not merged back (AD-20).

**`UserProgressContext` retirement is staged, not instant (assumption A1):** at cutover it stays as frozen read-only demo garnish powering the retained scaffold pages; epic-09's tickets retire it as each page re-points (AD-3's gradual language wins over AD-18's snapshot wording — logged as a deliberate reconciliation).

## User Stories

1. As a learner, I log in and my plans/tasks/progress are exactly where the static build left them (import) — and now sync across devices (FR-31).
2. As a learner, a dropped stream restarts cleanly and tells me it counted against my cap (no silent failure).
3. As user A, no trace of user B's normalized data ever renders (cache reset + SSE termination on auth change — FR-4).
4. As the demo operator, the pre-login surface stays static + fast (NFR-6), the demo account is pre-seeded, and rollback is one Pages redeploy.
5. As the test suite, deterministic tests still pass offline against the simulated double (AD-18).

## Implementation Decisions

- **Branch shape:** one integration branch off main; tickets land in order 1→6 with 4 ∥ 5 possible mid-branch; two-axis review (spec-conformance + defects) before merge; CI green pre-merge (epic-00's workflow).
- Apollo cache policy: normalized, type-policies minimal; codegen `typed-document-node`; **no local-mode ApolloLink shim** (owner decision — anonymous retirement is what makes Apollo coherent).
- Import mutation is the api-side `ImportDocument` command (idempotent upsert + ownership verification) — implemented **in this epic** if not already present in epic-03's set (kickoff delta-review checks; recorded either way).
- Error mapping table lives in web `src/` as data (code → i18n key), zh+en parity (AD-9).
- Token storage: memory + `synapse-token` localStorage (24h TTL aligns; exact choice at ticket with the "never silent" rule) — flagged A2.

## Testing Decisions

- Web suite stays deterministic: all AI-adjacent tests run against the simulated double (kept); server-adapter tests use the stub-GraphQL/SSE harness from api patterns.
- Import: idempotency (replay same doc), ownership conflict, partial re-attach → text-only PDF path.
- Cache reset: auth-change → no cached cross-user reads (regression test).
- SSE wrapper: drop → restart → cap-notice; terminal error → mapped key.
- Manual smoke (browser, dual language + both themes per repo norms): login → import → plan home → reader → companion stream → quiz → score moves server-side → logout/login persists.
- Gates: web tsc/lint/vitest/build + api rubocop/rspec; `just spec` end-to-end; deploy checklist in docs/deploy.md updated.

## Out of Scope

All feature epics (09–14) · re-queue UI (09) · any retained-page re-point beyond what the wall forces (09) · password reset/OAuth (14) · Neon backups/PITR (14's registry) · Gemini-of-epics process changes.

## Further Notes

- **A1** `UserProgressContext` staged retirement (reconciles AD-3 vs AD-18; epic-09 completes it).
- **A2** token persistence choice is ticket-level; memory-only was rejected (reload = logout friction for a study app).
- **A3** goal-selection step (FR-1's [Phase 2] note) rides T5 — it is generation input plumbing, not a new surface.
- Kickoff delta-review: confirm the import mutation's home (03 vs here), token storage A2, and that epics 02–06 trackers are all `done`.

# 01: Apollo Client 4 + codegen typed hooks replace TanStack Query + repositories

**What to build:** `@apollo/client` 4.x + graphql-codegen `typed-document-node` pipeline (epic-00's codegen grows real operations); every feature's data access moves from repository hooks to generated typed hooks against the epic-03/05 schema; **cache reset on any auth change** (login/logout/account switch — a single `resetApiClient()` seam); TanStack Query + `src/data` adapter layer retire from the runtime; UI-pref keys (`synapse-lang`, theme) untouched.

**Blocked by:** None (epic gate: 02+03+04+05+06 done).

**Status:** done (pending final gate sweep + two-axis review)

**Bound by:** AD-18 (Apollo owns domain data; no domain contexts; no local-mode shim), AD-2 (features never import each other's internals through the swap), AD-3 (the Query bridge retires — its retirement is this ticket's proof).

- [x] All plan-first surfaces read/write via typed hooks; zero `src/data` runtime imports (grep-guard — `src/data/` deleted; `src/test/architecture.guard.test.ts` pins TanStack/src-data/legacy-key retirement)
- [x] `resetApiClient()` clears cache + terminates SSE (the seam T2/T4/T5 call); cross-user isolation regression test rides ticket 02's login flow (the seam + terminator registry + Settings reset path landed here)
- [x] Domain entity rendering preserves Phase-1 behavior (mastery ring, node rows render **server** scores — no local recompute, AD-14). DELTA: results deltas + recent-activity per-session scores render the CURRENT server score/count only — the api exposes no pre-/per-session score surface (surfaced in the epic's delta log, candidate for epic-09/api)
- [x] Web gates green (tsc/lint/vitest 379/build/anti-drift); test count 314→379: repositories' localStorage tests retired with src/data, replaced by the stub-GraphQL harness walks (src/test/apollo-harness.tsx) + MockedProvider surface tests — feature behavior coverage preserved/integrated, not dropped

**Delivered (2026-11-04, commits d530e8d..):** Apollo Client 4 + committed codegen pipeline (freshness gate in just spec + CI) · src/apollo seam (client/auth-token/resetApiClient + terminator registry) · src/api typed-hooks layer (mapped domain views, server scores) · all six feature clusters + retained Quiz page re-pointed · plans/quiz/tasks/flashcards display-shaping flips to server fields · presign attach/refreshBytes upload flows · stub-GraphQL echo harness for offline driver/loop walks · entry gate lands on Plans Home (wizard at /onboarding, no flag write) · settings reset = prefs + sign-out (legacy doc kept as rollback substrate) · Vite dev proxy /graphql + /api/stream → :3000 (CORS untouched until T6) · AGENTS.md truth refresh.

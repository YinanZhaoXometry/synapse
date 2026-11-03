# 01: Apollo Client 4 + codegen typed hooks replace TanStack Query + repositories

**What to build:** `@apollo/client` 4.x + graphql-codegen `typed-document-node` pipeline (epic-00's codegen grows real operations); every feature's data access moves from repository hooks to generated typed hooks against the epic-03/05 schema; **cache reset on any auth change** (login/logout/account switch — a single `resetApiClient()` seam); TanStack Query + `src/data` adapter layer retire from the runtime; UI-pref keys (`synapse-lang`, theme) untouched.

**Blocked by:** None (epic gate: 02+03+04+05+06 done).

**Status:** ready-for-agent

**Bound by:** AD-18 (Apollo owns domain data; no domain contexts; no local-mode shim), AD-2 (features never import each other's internals through the swap), AD-3 (the Query bridge retires — its retirement is this ticket's proof).

- [ ] All plan-first surfaces read/write via typed hooks; zero `src/data` runtime imports (grep-guard)
- [ ] `resetApiClient()` clears cache + terminates SSE (the seam T2/T4/T5 call); cross-user isolation regression test
- [ ] Domain entity rendering preserves Phase-1 behavior (mastery ring, node rows, results deltas render **server** scores — no local recompute, AD-14)
- [ ] Web gates green (tsc/lint/vitest/build); vitest count may shift only by seam-swap edits, not feature tests

# 01: Golden-vector generator + committed fixtures

**What to build:** `web/scripts/generate-mastery-vectors.ts` (runs via the web toolchain) producing `api/spec/fixtures/mastery_vectors.json` from `domain/mastery.ts` + the streak rollup: every boundary in both directions (79↔80 score, 2↔3 evidence, window-5 edge, uncovered-node rollup, all-mastered 100, task single-node rollup, 99-cap), decimals as strings, timestamps timezone-tagged, streak day-boundary policy stated (A1: pin in ADR-0001 if Phase 1 left it implicit), rounding mode + operation order recorded in ADR-0001's terms. Deterministic output (sorted, stable keys). CI (web job) regenerates + diffs until the cutover retires the TS side.

**Blocked by:** None (needs only epic-00's layout).

**Status:** ready-for-agent

**Bound by:** AD-14 (fixture contract: strings/timezones/exact-equality), AD-6 (one implementation is the source), ADR-0001 (values).

- [ ] Generator runs green via `pnpm` script; fixture committed; regeneration = no diff
- [ ] Boundary matrix covers both directions of every threshold; case list reviewed against ADR-0001
- [ ] Streak policy stated (ADR amendment if needed — flagged, not smuggled)
- [ ] Web test suite count unchanged (a script, not test edits)

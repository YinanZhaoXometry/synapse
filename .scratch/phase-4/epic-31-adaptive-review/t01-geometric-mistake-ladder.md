# 01: Geometric mistake ladder + same-day guard

**What to build:** A student who keeps answering a mistake correctly sees its review interval double each round — 1 → 2 → 4 → 8 → 16 days — instead of capping at 7; and answering it wrong drops it back to tomorrow (existing behavior, now pinned by tests). Repeated quiz attempts within the same UTC day advance the ladder at most one rung, so one grinding session cannot fake long-term retention. The schedule stays a correct-on-wake recompute (AD-19): constants and the same-day rule live in the requeue scan's derivation, no new persisted state.

**Blocked by:** None (can start immediately).

**Status:** done (2026-11-11)

- [ ] The mistake ladder is [1, 2, 4, 8, 16] days; the final rung is terminal (due date keeps sliding with the anchor, spacing stays at 16d)
- [ ] Stage = consecutive `correct` evidence after the mistake; `wrong`/`partial` reset to 0 (existing semantics, pinned by parametrized specs over every rung)
- [ ] Same-day guard: two consecutive `correct` evidences on the same UTC calendar day advance the stage once, not twice; cross-day pairs advance normally
- [ ] All ladder/guard behavior is asserted through the scan command's specs (build source rows → run scan → assert schedule rows), including the cap rung
- [ ] Existing requeue specs stay green without semantic edits (the 7d-row assertions are updated to the new ladder, visibly)
- [ ] Gates green: rspec (incl. the SimpleCov floor), rubocop

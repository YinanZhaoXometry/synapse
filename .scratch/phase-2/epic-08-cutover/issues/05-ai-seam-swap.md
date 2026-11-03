# 05: CompanionService server adapter behind the seam; simulated → dev/test double; AppError map; goal selection

**What to build:** server implementation of the `src/ai` CompanionService interface (chat + plan-proposal streams via T4; quiz/flashcard/grading via epic-05 mutations) behind the **unchanged** interface — features never call AI ops via raw Apollo hooks (AD-5); the simulated implementation moves to dev/test-double duty (deterministic vitest keeps passing offline); the closed error enum ↔ `AppError.code` 1:1 mapping table lands web-side (zh+en keys); plan-creation **goal-selection step** feeds generation (A3 — input plumbing on the creation chat).

**Blocked by:** 1, 4.

**Status:** ready-for-agent

**Bound by:** AD-18 (double survives; runtime swaps), AD-5 (seam unchanged; contract server-side), AD-12/16 (error enum 1:1; adding a code touches both sides).

- [ ] Feature call sites unchanged (diff shows `src/ai` internals only) — the seam's proof
- [ ] All existing AI-adjacent vitest specs pass against the double unmodified
- [ ] AppError map covers the full closed enum; both languages
- [ ] Goal selection feeds the generation request (exam prep / deep understanding / revision / daily practice — FR-1 note)

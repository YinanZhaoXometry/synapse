# 05: CompanionService server adapter behind the seam; simulated → dev/test double; AppError map; goal selection

**What to build:** server implementation of the `src/ai` CompanionService interface (chat + plan-proposal streams via T4; quiz/flashcard/grading via epic-05 mutations) behind the **unchanged** interface — features never call AI ops via raw Apollo hooks (AD-5); the simulated implementation moves to dev/test-double duty (deterministic vitest keeps passing offline); the closed error enum ↔ `AppError.code` 1:1 mapping table lands web-side (zh+en keys); plan-creation **goal-selection step** feeds generation (A3 — input plumbing on the creation chat).

**Blocked by:** 1, 4.

**Status:** done (2026-11-04, `089e350` merged `14307d4` — 439→457 web green; review pending the epic's pre-merge pass)

**Bound by:** AD-18 (double survives; runtime swaps), AD-5 (seam unchanged; contract server-side), AD-12/16 (error enum 1:1; adding a code touches both sides).

- [x] Feature call sites unchanged except enumerated pass-through params (generateQuiz planId?/taskId?, gradeOpenAnswer questionId?, chat materialId? — server-contract-required, flagged in the epic delta log; no raw Apollo AI outside src/ai)
- [x] All existing AI-adjacent vitest specs pass against the double unmodified (`forceSimulatedCompanion()` once in test setup; zero existing test files modified — 457/457 green)
- [x] AppError map covers the full closed enum; both languages (streams: T4's STREAM_TERMINAL_KEYS; mutations: AI_MUTATION_KEYS)
- [x] Goal selection feeds the generation request (4-chip radiogroup + free-text override, canonical values on the wire)

**Surfaced gap (delta log):** the backend's GenerateQuiz persists its own session under the adapter-minted clientUuid, and the driver then creates another → each server-path quiz start leaves one orphaned ACTIVE session row (functionally coherent, nothing lists sessions; fix = thread the driver's clientUuid through the seam or a generate-only server op — exceeds the enumerated set, left for epic-owner decision).

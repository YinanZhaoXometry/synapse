# T2: Plan-flow quiz UI — launcher → runner → results with real mastery movement (FR-18/3; AD-6/8/9)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-quiz-session-engine.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The tracer bullet through the UI: from Plan Home's quick-actions, a
QuizLauncher block/dialog (UX spine contract) picks mode — Open, Choice, or
Mix — and scope — whole plan or one material (node scope is Phase 2). With no
materials attached the action is disabled with a bilingual reason; while
generating it shows 「来自 N 份材料 · 正在出题」 and stays cancellable until
the first question; generation failure is a neutral toast + retry with the
plan state untouched and no session created. Launching navigates to
`/plan/:id/quiz`, which persists the session and carries its id in the URL so
a reload resumes an active session; exiting asks once and marks the session
abandoned. The QuizRunner plays one question at a time with progress
("Q 3/8"), enforces the attempt gate visually, supports choice select +
confirm, open textarea → grading wait (「对照材料评分中」) → verdict with
rationale + citation, a free hint, forfeit, and the keyboard map
(1–4 / Enter / Esc). QuizResults shows the score, the per-question breakdown
with source excerpts, and each affected node's mastery move computed only
through display-shaping selectors over the domain functions — exact ADR-0001
numbers including the honest cap-99-below-gate behavior — with wrong answers
visible as the mistakes the mutation logged. 再来一轮 starts a fresh
generated session (new session id), honestly labeled when the simulated
generator produces near-identical questions.

## Acceptance criteria

- [x] The quiz route exists under the app layout (AD-8); an unknown plan or session id is handled gracefully, never a blank screen.
- [x] Launcher states match the spine: no-materials disabled with reason; generating cancellable until the first question; failure → neutral toast + retry, plan state untouched, no session created.
- [x] All three modes work end-to-end from Plan Home: choice auto-grades; open grades through the AI seam with rationale + citation shown; mix interleaves.
- [x] Attempt gate observable in render tests: no answer, rationale, or correct option is visible before submit or forfeit (NFR-8).
- [x] Each answer records evidence through the repository; the results screen's node movement matches the domain seam's numbers exactly (window 5, cap-99 below the gate, mastered = ≥ 80 & ≥ 3) — no display arithmetic in components (AD-6).
- [x] Wrong answers appear in the breakdown and exist as mistake entries in the store.
- [x] Reload mid-quiz resumes the active session via the URL; exit asks once and marks abandoned; abandoned sessions are not resumable.
- [x] 再来一轮 creates a new generated session (fresh session id), with honest labeling of near-identical simulated rounds.
- [x] Keyboard map (1–4 select, Enter confirm, Esc) works; i18n zh/en parity; semantic tokens only (AD-9); basic responsive correctness at docked/overlay widths.
- [x] Component render tests cover launcher states, runner flows (choice / open-with-grading-wait / forfeit / keyboard), resumption, and results; one plan-loop integration walk (material → generate → answer → evidence → visible movement); gates green via direct `node_modules/.bin` binaries.

## Implementation notes (for downstream tickets + epic close)

- Additive engine changes in T2: `QuizAnswerResult.options` (post-reveal text for
  your-answer vs correct-answer rendering) and `useQuizSession.cancelStart()` +
  generation-id guard (cancel guarantees no session; an orphan persist tick is
  marked abandoned, evidence-less).
- **Known limitation (accepted for Phase 1):** completed-session results are not
  reconstructible after a reload (grading rationale/citation are not persisted; the
  machine refuses non-active hydration) — a completed `?session` shows an honest
  "already complete" card with back/new-quiz actions. Quiz-history views belong to
  the FR-42 hub (Phase 2), which will need persisted grading views.
- **Seam quirk (Phase-2 improvement, not a defect):** the simulated generator's node
  round-robin runs over ALL candidate sections before the mode filter, so a
  choice-only run attributes every question to the same node(s). Attribution is
  honest; Mix demos distribute across nodes.
- Verified 2026-11-03: tsc 0 errors, eslint 0 errors (10 pre-existing warnings),
  vitest 344/344 (+37). Commit `e9b50f8`.

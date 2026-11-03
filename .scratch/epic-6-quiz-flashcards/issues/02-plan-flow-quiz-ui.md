# T2: Plan-flow quiz UI — launcher → runner → results with real mastery movement (FR-18/3; AD-6/8/9)

Status: ready-for-agent
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

- [ ] The quiz route exists under the app layout (AD-8); an unknown plan or session id is handled gracefully, never a blank screen.
- [ ] Launcher states match the spine: no-materials disabled with reason; generating cancellable until the first question; failure → neutral toast + retry, plan state untouched, no session created.
- [ ] All three modes work end-to-end from Plan Home: choice auto-grades; open grades through the AI seam with rationale + citation shown; mix interleaves.
- [ ] Attempt gate observable in render tests: no answer, rationale, or correct option is visible before submit or forfeit (NFR-8).
- [ ] Each answer records evidence through the repository; the results screen's node movement matches the domain seam's numbers exactly (window 5, cap-99 below the gate, mastered = ≥ 80 & ≥ 3) — no display arithmetic in components (AD-6).
- [ ] Wrong answers appear in the breakdown and exist as mistake entries in the store.
- [ ] Reload mid-quiz resumes the active session via the URL; exit asks once and marks abandoned; abandoned sessions are not resumable.
- [ ] 再来一轮 creates a new generated session (fresh session id), with honest labeling of near-identical simulated rounds.
- [ ] Keyboard map (1–4 select, Enter confirm, Esc) works; i18n zh/en parity; semantic tokens only (AD-9); basic responsive correctness at docked/overlay widths.
- [ ] Component render tests cover launcher states, runner flows (choice / open-with-grading-wait / forfeit / keyboard), resumption, and results; one plan-loop integration walk (material → generate → answer → evidence → visible movement); gates green via direct `node_modules/.bin` binaries.

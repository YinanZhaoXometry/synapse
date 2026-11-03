# Epic 6 — Quiz + Flashcards, in-flow generation & evidence (FR-18/19)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core

## Parent

Spec: [spec.md](spec.md) (grill round closed 2026-11-03, all 8 recommendations
adopted — owner confirmed 「全按推荐」, with the addendum that every
coupling-point ticket is ordered last and executes only after its blockers
clear). Bound by the architecture spine (AD-2/5/6/8/9/10), ADR-0001, the UX
spine (EXPERIENCE.md — QuizLauncher / QuizRunner / QuizResults /
FlashcardStudy contracts, attempt gate, keyboard maps), GLOSSARY.md, and the
PRD Phase-1 slice.

## Scope note (slice 6 of the phase-1 table)

The foundation this epic consumes is all on main: the AI seam's
generateQuiz / generateFlashcards / gradeOpenAnswer (simulated implementations
included), the quiz repository's evidence mutation (atomic evidence +
auto-mistake + session completion), the flashcard repository, the v1 database
stores (sessions / questions / evidence / flashcards / mistakes), and the
ADR-0001 domain functions. Epic-5 lands first per the adopted sequential stance
(grill Q8) — its Task Home placeholder tiles are this epic's replacement
targets, and the tasks-key invalidation it deferred belongs here. Nothing
writes to the frozen scaffold progress context.

## What to build

`features/quiz` (session state machine — the epic's one new seam — plus
launcher, runner, results) and `features/flashcards` (generation + flip-first
study + persisted self-rating). Plan-flow quiz first (the survival line:
FR-18's full evidence loop from Plan Home), plan-flow flashcards second, then
the coupling tails in owner-mandated order: task-flow wiring
(`/task/:id/quiz` + `/task/:id/flashcards`, Task Home tiles → real, tasks-key
invalidation) and the `/quiz` scaffold re-point that turns its false
"evidence logged" claim true. Zero SRS; single-select choice; retake = fresh
generated session.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-quiz-session-engine.md](issues/01-quiz-session-engine.md) | — | Headless quiz session engine: state machine + seam wiring + evidence loop, fully seam-tested (FR-18; AD-5/6; ADR-0001) |
| 2 | [02-plan-flow-quiz-ui.md](issues/02-plan-flow-quiz-ui.md) | 1 | Plan-flow quiz end-to-end: launcher → runner → results with real mastery movement (FR-18/3; AD-6/8/9) |
| 3 | [03-plan-flow-flashcards.md](issues/03-plan-flow-flashcards.md) | 2 | In-flow flashcards: generate → flip-first study → persisted self-rating, never evidence (FR-19; AD-6/9) |
| 4 | [04-task-flow-wiring.md](issues/04-task-flow-wiring.md) | 1, 2, 3, epic-5 T2 | Task-flow launches + Task Home tiles → real + tasks-key invalidation (FR-37 parity; AD-6/8) — coupling tail |
| 5 | [05-quiz-page-repoint.md](issues/05-quiz-page-repoint.md) | 1, 2 | `/quiz` re-pointed to the real seam; false "evidence logged" claim removed (FR-36 carve-out) — coupling tail |
| 6 | [06-walks-gates-close.md](issues/06-walks-gates-close.md) | 4, 5 | Plan-loop + task-loop walks, responsive/theme/i18n sweep, gates, epic close (AD-9/10) |

## Definition of done

FR-18/19 acceptance in-flow for plans and tasks (materials-sourced only,
Open + Choice + Mix, attempt gate, evidence-only mastery) · FR-36 carve-out
complete (`/quiz` real, no fake deltas anywhere) · every answer moves mastery
exactly per ADR-0001 (window 5, cap-99 below the 3-evidence gate, mastered =
≥ 80 & ≥ 3) · flashcard self-ratings create zero evidence · gates green
(`npx tsc -b`, `npm run lint`, `npm run test` — AD-10, run via direct
`node_modules/.bin` binaries) · frozen scaffold context untouched · every
ticket cites its AD ids · all new surfaces verified in light + dark ×
sunset/twilight/aurora × desktop/tablet/mobile, i18n zh/en parity throughout.

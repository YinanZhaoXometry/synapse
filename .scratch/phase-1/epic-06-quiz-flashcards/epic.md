# Epic 6 — Quiz + Flashcards, in-flow generation & evidence (FR-18/19)

Status: done
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

## Deferred follow-ups (Phase 2 + backlog)

Consolidated at T6 from the T1–T5 implementation notes and [spec.md](spec.md)
Out of Scope (the governing record — nothing here is a regression or a cut
corner; every item was a decision).

**Quiz**
- **Quiz hub (FR-42):** session history listing + past-quiz retake. Needs
  persisted grading views first (T2 note): completed results are not
  reconstructible after a reload — grading rationale/citation are not persisted
  and the machine refuses non-active hydration, so a completed `?session`
  shows the honest "already complete" card.
- **Multi-select choice questions** (spec decision 2's deliberate Phase-1 cut;
  single-select is the governing reading, the entity contract and keyboard map
  are single-select shaped).
- **Node-level quiz scope** (UX spine marks Phase 2; the launcher scopes whole
  plan / one material; tasks are trivially their single material).
- **Mistakes Notebook surface (FR-23)** — entries already auto-log silently
  beneath it (the evidence mutation's atomic tail); the surface reads the
  existing store. **Adaptive weak-spot targeting (FR-21)** and **Quick Test
  (FR-14)** stay out per spec.
- **Generator improvement (T2 seam quirk — honest but suboptimal):** the
  simulated generator's node round-robin runs over ALL candidate sections
  before the mode filter, so choice-only runs attribute every question to the
  same node(s). Round-robin after the mode filter (or per-kind) distributes
  concentration runs across nodes. Attribution stays honest either way; Mix
  demos already distribute.
- **Hint budgeting / timer / gamified quiz mechanics** beyond the UX spine
  (deliberately out).

**Flashcards**
- **SRS / re-queue scheduling (FR-24):** zero scheduling shipped; the persisted
  难 / 中 / 易 self-ratings are the future scheduling input.
- **Flashcards hub (FR-41)** — and with it the post-hoc-materials gap (T3
  note): materials attached to a plan AFTER its first generation get no cards
  until Phase 2 (a 补充生成 pass or the hub's per-material generation).
- **Regeneration / deep-linked retake polish** (T3 policy: generation is
  offered only when the plan has no cards; 「继续学习」 opens the existing deck;
  再学一轮 restarts the same queue).
- **Scaffold `/flashcards` demo re-point** (spec decision 10 keeps it
  untouched — it writes no mastery lies).

**Demo + polish**
- **`/quiz` terminal-card deep-link** (T5 note): after a reload the completed
  session's card offers 重新出题 → the picker; deep-linking back to the SAME
  material was deferred.
- **Dialog-launch resume-note polish (T4 note)** — resolved in T6: a
  per-tab sessionStorage marker (`synapse-quiz-fresh-launch`, written by
  QuizLauncher, consumed once by the session shell) suppresses the 「已恢复」
  note on deliberate dialog launches; genuine reloads keep it.

## Closure skeleton (final numbers + smoke filled by the orchestrator)

Shipped T1–T6 (`7782b24` → T6's fix commit). Verification at close:
- Gates: `tsc -b` 0 errors · eslint 0 errors (10 pre-existing scaffold
  warnings) · vitest **<N>/<N> tests, <M> files** (T5 left 391/391; T6 adds
  2 — the plan-loop retake chain walk and the task dialog-launch marker test).
- Walks (the epic's number-truth anchors):
  - `src/test/plan-quiz-loop.integration.test.tsx` — Plan Home dialog → mix
    run → atomic evidence → exact ADR-0001 numbers (round 75%, n1 99 capped,
    n2 50, cap note ×2) → reload honesty; plus the T6 retake chain: 99 capped
    → 100 mastered at the 3-record gate → the last-5 window evicts
    (100→60 / 75→50) → 4 auto-logged mistakes.
  - `src/test/task-quiz-loop.integration.test.tsx` — Task Home dialog → choice
    run → evidence on the task's node only → tasks-key invalidation → Task
    Home ring + Plans Home task section fresh → sibling plan untouched →
    flashcards leg (ratings persist, zero evidence).
- Sweeps (T6, code level): semantic tokens clean (only the scaffold-accepted
  `text-white`-on-`bg-gradient-hero` convention) · i18n zh/en parity tests
  green + no hardcoded user-facing strings · sonner-only toasts · keyboard
  maps wired (quiz 1–4/Enter/Esc, flashcards Space/←→/Esc) · responsive
  ladder present on every surface (max-w containers, flex-wrap footers,
  sm:/md:/lg: breakpoints).
- Browser smoke 双主题双视口 + ticket/epic `Status:` flips: **orchestrator,
  after review**.

## Closed — 2026-11-03

All six tickets done. Two-axis review PASS-WITH-FIXES (0P0/0P1/3P2, all fixed
`f73f7d8`) · browser smoke 11 checks green (quiz loop, evidence honesty,
rollup freshness, flashcards, task twins, /quiz demo, themes, mobile) · gates
green via direct binaries: tsc 0 errors, eslint 0 errors (10 pre-existing),
vitest **400/400**. Branch `epic/6-quiz-flashcards` FF-merged to main and
pushed (epic-3/5 precedent). FR-18/19 in-flow for plans AND tasks; FR-36
carve-out complete — no fake evidence claim remains anywhere.

**Phase-2 pointers carried in Deferred follow-ups above**; note for the AD-16
AI-seam cutover checklist: open-answer grading failure now has a user-facing
recovery path (`releaseGrading`), and the seam's rejection contract should be
kept (the driver relies on it).

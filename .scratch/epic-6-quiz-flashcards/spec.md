# Spec: Epic 6 — Quiz + Flashcards, in-flow generation & evidence (FR-18/19)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core

> Grill round closed 2026-11-03 — all 8 frontier questions accepted by
> recommendation (owner confirmed 「全按推荐」), plus one owner addendum: every
> ticket that touches a cross-epic coupling point is ordered last and executes
> only after its blockers clear. Testing seams below follow that confirmation;
> one new seam is introduced (the quiz session state machine — the epic's only
> genuinely new logic).

## Problem Statement

The study loop has no evidence engine. Mastery Score (FR-3) is defined as
evidence-only, and quiz answers are the only Phase-1 evidence source — but no
real quiz exists. The learner who finishes studying a plan has nowhere to test
themselves: Plan Home's quiz/flashcard tiles are placeholders, the standalone
`/quiz` is a grandfathered demo that writes hardcoded mastery deltas into an
in-memory scaffold context while its results screen claims "evidence logged",
and `/flashcards` is a static flip demo. Meanwhile the machinery is already
built and idle: the AI seam exposes quiz/flashcard generation and open-answer
grading, and the data layer already persists quiz sessions, questions,
evidence records (with automatic mistake logging), and flashcards. The product's
core promise — a number that moves only when you prove mastery — is unreachable.

## Solution

Quizzes and flashcards generate and launch inside the study flow. From Plan
Home a launcher picks a mode (Open / Choice / Mix) and a scope (whole plan or
one material), generates questions drawn strictly from the attached materials
via the AI seam, and runs a one-question-at-a-time session with an attempt
gate — nothing reveals before submit or forfeit. Choice answers auto-grade;
open answers are graded against the material with the rationale and source
citation shown. Results show the per-question breakdown with material
grounding and the real mastery movement per node, computed by the shipped
ADR-0001 domain functions from evidence recorded through the shipped
repository (which auto-logs mistakes). Flashcards generate from the same
materials, study flip-first with an honest self-rating that never touches
evidence. The task flow gains the same launches once Task Home exists, and the
scaffold `/quiz` demo is re-pointed at the real seam so its honesty claim
finally becomes true.

## User Stories

1. As a learner studying a plan, I want to launch a quiz from Plan Home by picking a mode — Open, Choice, or Mix — so I choose how I want to be tested (FR-18).
2. As a learner, I want the quiz drawn only from the plan's attached materials, so no question asks about anything I wasn't given (NFR-1 sourcing honesty).
3. As a learner, I want each question grounded in its source with the material reference shown, so I can trust where it came from.
4. As a learner, I want to scope a quiz to the whole plan or to a single material, so I can drill what I just read (node-level scope stays out — Phase 2).
5. As a learner, I want a Mix quiz to interleave open and choice questions in one session, so practice feels like the real exam (FR-18 Mix Mode).
6. As a learner, I want the generating state to be visible ("来自 N 份材料 · 正在出题") and cancellable until the first question, so a slow generation never traps me.
7. As a learner with no materials attached, I want the quiz action disabled with a bilingual reason, so the disabled state explains itself (UX spine).
8. As a learner, if generation fails I want a neutral toast and a retry with the plan state untouched, so a failure is a moment, not a dead end.
9. As a learner in a quiz, I want one question at a time with progress ("Q 3/8"), so I always know where I am.
10. As a learner on a choice question, I want to select one option and confirm, so accidental taps don't count as answers (single-select in Phase 1).
11. As a learner on an open question, I want to write my answer, see a grading wait ("对照材料评分中"), then the verdict with the grading rationale, so machine grading is transparent (FR-18).
12. As a learner, I want the attempt gate enforced — no answer, rationale, or correct option reveals before I submit or forfeit — so recall is real (NFR-8).
13. As a learner, I want a free hint button on every question, so being stuck isn't a dead stop (UX spine).
14. As a learner, I want to forfeit a question — revealed as wrong and logged — so honesty about not knowing moves my score truthfully (ADR-0001: forfeit = 0).
15. As a learner, I want exiting mid-quiz to ask once and mark the session abandoned, so quitting is deliberate, never accidental.
16. As a learner, I want full keyboard play (1–4 to select, Enter to confirm, Esc), so practice is fast on a laptop (UX spine keyboard map).
17. As a learner who reloads mid-quiz, I want my active session resumed from where I was, so a refresh never costs my progress.
18. As a learner, I want results showing my score, a per-question breakdown with the source excerpt, and what I got wrong with the correct answer, so the review is where learning happens.
19. As a learner, I want the results screen to show each affected node's mastery move computed from my real evidence — including the honest cap-99-below-gate behavior — so the number I see is the number the system keeps (ADR-0001, FR-3).
20. As a learner, I want my wrong answers logged as mistake entries automatically, so the future mistakes notebook accumulates without extra clicks.
21. As a learner, I want "再来一轮" to start a fresh generated session rather than replay old questions, so retaking never inflates my score by repetition (NFR-8 / FR-42 stance).
22. As a learner, I want retakes labeled honestly when the simulated generator produces near-identical questions, so the demo never overclaims variety.
23. As a learner studying a plan, I want to generate flashcards from the plan's materials and study them flip-first, so recall practice lives inside the flow (FR-19).
24. As a learner, I want the flashcard to always show its front before the flip, so studying starts with attempted recall (NFR-8).
25. As a learner, I want to rate each card 难 / 中 / 易 after the flip and have it persist, so my ratings survive reloads and feed future scheduling (FR-24 pointer).
26. As a learner, I want my flashcard self-ratings to never move my Mastery Score, so discomfort with a card is not mistaken for evidence (ADR-0001).
27. As a learner, I want flashcard study keyboard controls (Space to flip, arrows to navigate, Esc to exit), so review is one-handed and fast (UX spine).
28. As a learner, I want a study summary when flashcards end and a path back to the plan, so the session closes cleanly.
29. As a learner with a Study Task, I want to launch a quiz from Task Home against its single material and node, so plan-free study gains the same evidence loop (FR-37 parity; FR-18).
30. As a learner with a Study Task, I want to study flashcards from Task Home the same way, so the twin surfaces stay twins.
31. As a learner, I want quiz evidence on a task's node to update the task ring everywhere it shows, including Plans Home's task section, so no surface shows a stale number.
32. As a learner opening the old `/quiz` page, I want it to generate a real quiz from a material I pick and record real evidence, so the demo stops lying about "evidence logged" (FR-36 carve-out).
33. As a Chinese- or English-speaking learner, I want every new surface fully bilingual, so language never breaks the flow (AD-9).
34. As a learner in dark mode or another palette, I want all new surfaces built on semantic tokens, so nothing breaks in dark / sunset / twilight / aurora (AD-9).
35. As a learner on a phone or tablet, I want the quiz and flashcard surfaces to follow the app's responsive ladder, so practice works on any screen (AD-9).

## Implementation Decisions

1. **Coupling-last ordering (owner addendum).** Plan-flow quiz is the survival
   line, flashcards second; every coupling-point ticket — task-flow wiring,
   `/quiz` re-point — is ordered last and blocked on the epic-5 tickets that own
   its coupling surface (Task Home). With the adopted sequential stance
   (epic-5 → epic-6) those blockers are expected to be already clear at
   implementation time; the edges are still recorded formally.
2. **Choice is single-select in Phase 1.** FR-18's "single- or multi-select" is
   deliberately cut to single-select (the entity contract already says so;
   keyboard map 1–4 and the simulated generator's distractor quality are
   single-select shaped). Multi-select is a Phase-2 item; recorded here as the
   governing reading.
3. **Open-answer grading exclusively through the AI seam.**
   `gradeOpenAnswer` returns outcome + rationale + citation; the rationale and
   source citation are rendered (FR-18 "grade rationale shown"). No client-side
   grader is built; the Phase-2 LLM swap touches only the seam implementation.
4. **Generation exclusively through the AI seam**, node-attributed at
   generation (AD-6): every generated question carries its source material and
   section ids — those ids are the grounding citations. Nothing synthesizes
   questions outside the seam.
5. **Evidence exclusively through the repository.** Each answer (correct /
   partial / forfeit-wrong) becomes one EvidenceRecord via the evidence
   mutation, which atomically logs mistake entries for wrong answers and
   completes the session. Mastery display flows only through the domain
   functions (`computeNodeScore`, `getNodeState`, plan/task rollups) via pure
   display-shaping selectors. The frozen scaffold progress context receives no
   writes.
6. **Routes and launcher shape.** Plan flow ships
   `/plan/:id/quiz` + `/plan/:id/flashcards`; the task-flow ticket adds
   `/task/:id/quiz` + `/task/:id/flashcards`. The QuizLauncher is a block/dialog
   on Plan (later Task) Home per the UX spine — mode select + scope select
   (whole plan / this material; node scope is Phase 2). Task-flow quiz targets
   the task's single auto-owned node (epic-5's PRD reconciliation applies:
   plan-scoped FRs read as extended to tasks via FR-37's governing clause).
7. **Session resumption.** The quiz session id lives in the URL; an active
   session resumes after reload. Exit-asks-once marks the session abandoned;
   abandoned sessions are not resumable. Flashcard study is deliberately
   stateless across reloads — ratings persist per card as they happen, so a
   refresh only restarts the flip queue, losing nothing.
8. **Retake = a new generated session.** No history listing or past-quiz
   retake plumbing (FR-42 hub is Phase 2). The simulated generator produces
   near-identical rounds; the UI labels this honestly rather than pretending
   fresh variety.
9. **Zero SRS in this epic.** No scheduling of any kind; deck order is
   material section order. Flashcard difficulty is the UX-spine self-rating
   trio persisted through the existing rating mutation; it never creates
   evidence (ADR-0001). Re-queue scheduling stays FR-24 / Phase 2.
10. **`/quiz` re-point, `/flashcards` stays.** The scaffold `/quiz` loses its
    hardcoded deltas and fake bank and becomes a real-seam demo outside plan
    context (material picker → real generation → real evidence) — its
    "evidence logged" claim becomes true. The scaffold `/flashcards` demo
    stays untouched: it writes no mastery lies, and hub-level flashcards are
    Phase 2 (FR-41).
11. **Module layout & conventions.** New `features/quiz` and
    `features/flashcards` modules (capability map rows FR-18/19); dependency
    direction pages → features → {domain, data, ai}; no new domain contexts
    (AD-2); no database schema changes — the v1 document already has
    sessions / questions / evidence / flashcards / mistakes stores. All copy
    under quiz/flashcard-namespaced i18n keys with zh/en parity; semantic
    tokens only; sonner toasts (AD-9).
12. **Mix mode** = Open + Choice questions interleaved in one session (the
    session entity's mode field already carries open / choice / mix).

## Testing Decisions

- A good test asserts external behavior only: exact ADR-0001 numbers (window
  5, cap-99 below the 3-evidence gate, mastered = ≥ 80 & ≥ 3), observable
  attempt-gate behavior (no reveal before submit/forfeit), honest state
  transitions (generating / resumable / abandoned), bilingual copy keys — never
  internal component state, and no duplicated display arithmetic in tests.
- **Seams:**
  1. **Quiz session state machine (the one new seam)** — a pure module in the
     quiz feature owning transitions (generate → answer → submit/grade →
     forfeit → complete), gate enforcement, and outcome mapping; tested
     directly (prior art: the domain pure-function tests).
  2. **Repository seam** — the evidence mutation's atomic behavior (evidence +
     auto-mistake + session completion) exercised through real localStorage
     stores (prior art: the foundation epic's repository tests; extended only
     where the quiz flows touch it).
  3. **Component render seam** — jsdom render tests over real hooks, the
     simulated AI service, and a seeded database: runner flows (choice /
     open-with-grading-wait / forfeit / keyboard), launcher states
     (no-materials disabled, generating cancellable, failure toast), results
     (real node movement), flashcard study (front-first, ratings persist)
     (prior art: reader and plans component tests).
  4. **Integration-walk seam** — one plan-loop walk: material attached →
     generate → answer → evidence → mastery movement visible on the plan
     surface (prior art: the evidence-loop and reader-loop integration walks).
- Gates run via direct `node_modules/.bin` binaries (`tsc -b`, eslint,
  `vitest run`) — the pnpm-layout environment breaks `npm run`.

## Out of Scope

- Multi-select choice questions (Phase 2 — deliberate cut, decision 2).
- SRS / re-queue scheduling (FR-24), quiz & flashcard hubs with history and
  past-quiz retake (FR-41/42), the Mistakes Notebook surface (FR-23 — entries
  auto-log silently beneath it), adaptive weak-spot targeting (FR-21), Quick
  Test (FR-14).
- Node-level quiz scope (UX spine marks it Phase 2).
- The scaffold `/flashcards` page's re-pointing (hub territory, Phase 2).
- Hint budgeting, timer, or gamified quiz mechanics beyond the UX spine.
- Any backend work (AD-12..20 is Phase 2); Onboarding, navigation-group, and
  entry-decision changes beyond Plan Home's quick-actions block.

## Further Notes

- **Nov-6 priority order if the schedule squeezes:** plan-flow quiz
  (evidence closed loop) → flashcards → task-flow wiring → `/quiz` re-point.
  The first two alone satisfy FR-18/19 in-flow; the tails complete FR-36's
  carve-out and the UJ-6 task-loop demo step.
- **Sequencing stance (grill Q8):** epic-5 (4 tickets, ready-for-agent)
  implements first; epic-6 follows sequentially. Both epics touch the route
  table and Plans/Plan Home — the proven single-lane order avoids the parallel
  reconciliation cost that epic-4 paid.
- **Honesty thread:** this epic is where the app's "evidence logged" sentence
  becomes true. Until the `/quiz` re-point lands, that page remains the only
  surface making a false claim, and it is grandfathered demo chrome.
- **UX reference:** the binding references are the QuizLauncher / QuizRunner /
  QuizResults / FlashcardStudy contracts, the attempt-gate and keyboard maps,
  the generating/grading/results state patterns, and the journey step
  "Mix quiz launched from Plan Home quick-actions".

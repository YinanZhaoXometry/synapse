# T3: Plan-flow flashcards — generate → flip-first study → persisted self-rating (FR-19; AD-6/9)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-plan-flow-quiz-ui.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

In-flow flashcards for a plan: a flashcards entry on Plan Home generates cards
from the plan's attached materials through the AI seam (no-materials disabled
with reason; failure = neutral toast + retry) and lands on
`/plan/:id/flashcards` for a flip-first study session — the front is always
shown before any reveal (NFR-8), Space/click flips, arrows navigate, Esc
exits. After the flip, the difficulty trio 难 / 中 / 易 is offered; the
self-rating persists through the existing rating mutation, survives reloads,
and never creates an EvidenceRecord (ADR-0001). Deck order is material section
order; zero scheduling of any kind (FR-24 re-queue stays Phase 2). Ending the
session shows a summary and a path back to the plan. Study state is
deliberately stateless across reloads — ratings are already saved as they
happen, so a refresh only restarts the flip queue and loses nothing.

## Acceptance criteria

- [x] Generation runs through the AI seam only; cards carry their source material references; no-materials is disabled with a bilingual reason; failure → neutral toast + retry.
- [x] Front-before-reveal is enforced and asserted in a render test: back content is absent from the DOM until the flip (NFR-8).
- [x] Difficulty trio (难 / 中 / 易) persists per card — a reload keeps prior ratings — and produces zero EvidenceRecords (assert the evidence store is unchanged).
- [x] Keyboard map (Space flip, ←→ navigate, Esc exit) works; the session ends with a summary and a back-to-plan path.
- [x] Deck order follows material section order; no scheduling or re-queue logic exists anywhere in the flow.
- [x] i18n zh/en parity; semantic tokens only (AD-9); basic responsive correctness at docked/overlay widths; component render tests + gates green via direct `node_modules/.bin` binaries.

## Implementation notes (for downstream tickets + epic close)

- Regeneration policy (sanctioned simplest fallback): tiles/study open existing
  cards when any exist; generation is offered only when the plan has none.
  **Deferred follow-up:** materials attached to a plan AFTER its first generation
  get no cards until Phase 2 (补充生成 or the FR-41 hub) — recorded in the epic's
  deferred list.
- Flashcard query hooks live in `src/data/quiz-queries.ts` (not a separate
  flashcard-queries file); T3 consumed them, added no data-layer files.
- Esc exits immediately (ratings already persist); the summary lands when the
  last card is rated. Generated cards carry `nodeId: null` — ratings never touch
  evidence (asserted byte-identical in tests).
- Verified 2026-11-03: tsc 0 errors, eslint 0 errors (10 pre-existing warnings),
  vitest 366/366 (+22). Commit `56bd183`.

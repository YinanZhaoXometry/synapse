# T6: Simulated quiz/flashcard generation + open-answer grading

> Migrated from GitHub issue #13 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/13

Status: done
Blocked by: 05

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

Simulated generation and grading, strictly materials-sourced: quiz questions template-extracted from provided parsed sections (headings → "What is X?" Choice questions; key sentences → cloze), 5–8 per quiz, mode Open/Choice/Mix respected; flashcards as heading/definition pairs; every question carries node attribution (round-robin over the plan's nodes; the task's single node). Open answers grade by keyword-overlap against the question's source section with a rationale citing the matched sentence.

## Acceptance criteria

- [x] Every generated question traces to provided section text — fixture test; nothing generated from outside the materials (FR-18 sourcing)
- [x] Only Open and Choice question shapes ever appear; mode selection respected — tested
- [x] Every question carries node attribution at generation time — tested (AD-6)
- [x] Grading follows the overlap rule (≥2 hits correct, 1 hit partial, 0 wrong) and returns rationale + citation — tested
- [x] Deterministic for identical inputs — tested
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-5, AD-6, FR-18/NFR-1 sourcing constraint.

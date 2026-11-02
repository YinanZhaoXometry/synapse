# T4: Evidence loop repositories — quiz/flashcard/mistake + recordEvidence

> Migrated from GitHub issue #12 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/12

Status: done
Blocked by: 02

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The spine's core data flow minus UI: QuizSession/Question and Flashcard repositories, MistakeEntry logging, and the batch recordEvidence mutation — the one write path that turns finished quiz answers into node-attributed EvidenceRecords. Wrong answers (Choice or graded Open) create MistakeEntries; flashcard difficulty ratings persist on the Flashcard but never create EvidenceRecords. Stored evidence must drive domain mastery recomputation exactly per ADR-0001.

## Acceptance criteria

- [x] recordEvidence appends a batch of node-attributed EvidenceRecords atomically (whole batch or nothing) — tested
- [x] QuizSession + Question round-trip; a forfeited question records wrong evidence
- [x] Every wrong answer creates a MistakeEntry carrying source location and the user's answer
- [x] Flashcard ratings persist on the Flashcard record and create no EvidenceRecord — tested
- [x] Integration: reading stored evidence through the repository and computing mastery matches ADR-0001 expectations (window, gate, rollup)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-3, AD-5 (attribution at generation), AD-6, ADR-0001.

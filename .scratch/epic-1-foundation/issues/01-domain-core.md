# T1: Domain core — entity types + mastery function + streak

> Migrated from GitHub issue #8 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/8

Status: done
Blocked by: —

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The pure domain module every later surface computes from: all spine entity types (single source of truth, language-neutral, zero React imports), the ReadingPosition domain type, and mastery per ADR-0001 — windowed evidence mean, mastered gate, plan rollup, task rollup — plus the consecutive-evidence-days streak. Verifiable on its own: the mandated vitest suite passes and nothing else in the app changes.

## Acceptance criteria

- [x] Entity types exist for all 12 spine entities + ReadingPosition; language-neutral; no React imports from the domain module (AD-1/AD-2)
- [x] Node score = round(100 × mean of last 5 outcomes); outcomes {correct 1, partial 0.5, wrong/forfeit 0}; all constants in one exported MASTERY_CONFIG (ADR-0001)
- [x] mastered requires score ≥80 AND ≥3 total EvidenceRecords; uncovered = no evidence; partial = everything between
- [x] Plan rollup = mean of node scores with uncovered nodes at 0; reaches 100 only when every node is 100; a Study Task's rollup reads its single node's score
- [x] Tested: uncovered-never-green · one correct answer ≠ mastered (gate) · window aging (an early wrong drops out after 5 newer outcomes) · evidence-only movement · forfeit grades as wrong
- [x] Tested: streak counts consecutive days with ≥1 EvidenceRecord; a gap breaks it; minutes/logins never count
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-1, AD-2, AD-6, ADR-0001, AD-10.

# T1: Quiz session engine — state machine + evidence loop, headless (FR-18; AD-5/6; ADR-0001)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: — (prefactor; can start immediately)

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's one new seam, built first so the UI ticket consumes it: a pure quiz
session state machine in the quiz feature owning every transition from
generated questions to completed evidence — generate (questions in from the AI
seam, node-attributed per AD-6) → answer → submit (choice auto-graded
client-side; open graded through the AI seam with rationale + citation carried
through) → forfeit (revealed as wrong) → complete. The attempt gate lives
here: no machine output exposes the answer, rationale, or verdict before
submit or forfeit. Outcome mapping follows ADR-0001 exactly (correct 1 /
partial 0.5 / forfeit-wrong 0); each graded answer becomes one EvidenceRecord
through the existing evidence mutation, which atomically logs mistake entries
for wrong answers and completes the session. Mix mode interleaves open and
choice questions in one machine run. An exit path reaches a terminal
`abandoned` state. No UI in this ticket — it is exercised entirely at the
seam and repository level, and nothing writes to the frozen scaffold context.

## Acceptance criteria

- [x] State machine transitions tested directly at the new seam: full generate → answer → submit/grade → forfeit → complete paths for choice, open, and mix runs.
- [x] Attempt gate enforced at the machine level: no reveal of answer, rationale, or verdict before submit or forfeit (asserted via machine outputs, not component internals).
- [x] Choice auto-grade maps correct → 1; open answers map through the AI seam's grading outcome (correct / partial / wrong) with rationale + source citation carried on the result; forfeit maps to 0 and is logged.
- [x] Every completed answer path lands exactly one EvidenceRecord with node attribution via the evidence mutation; wrong answers auto-produce mistake entries; the session completes atomically (prior art: foundation repository tests).
- [x] Mix mode interleaves open + choice in one session (the entity's mode field already carries it).
- [x] Abandoned is a reachable terminal state via the exit path; an abandoned session is not resumable.
- [x] No UI changes, no writes to the frozen scaffold progress context; gates green via direct `node_modules/.bin` binaries (`tsc -b`, eslint, `vitest run`).

## Implementation notes (for downstream tickets)

- Machine input is the persisted `Question[]` (post-`createQuizSession`), not raw
  `GeneratedQuestion[]` — the repository assigns the ids `recordEvidence` validates;
  attribution still flows solely from `GeneratedQuestion.nodeId` (AD-6).
- **Hydration resumes at question 1**: per-question progress is not persisted (no
  schema change), so a resumed active session honestly shows all questions pending.
  T2's resumption UX must say so (not pretend mid-quiz restore).
- Driver reads via repository (`getQuizSession` / `listQuestionsBySession` /
  `getMaterial`), writes via query mutations; evidence lands exactly once on the
  running→completed edge; abandon persists status and records no evidence.
- Verified 2026-11-03: tsc 0 errors, eslint 0 errors (10 pre-existing scaffold
  warnings), vitest 307/307 (24 new: 19 machine + 5 driver). Commit `7782b24`.

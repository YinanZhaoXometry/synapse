# T1: Quiz session engine — state machine + evidence loop, headless (FR-18; AD-5/6; ADR-0001)

Status: ready-for-agent
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

- [ ] State machine transitions tested directly at the new seam: full generate → answer → submit/grade → forfeit → complete paths for choice, open, and mix runs.
- [ ] Attempt gate enforced at the machine level: no reveal of answer, rationale, or verdict before submit or forfeit (asserted via machine outputs, not component internals).
- [ ] Choice auto-grade maps correct → 1; open answers map through the AI seam's grading outcome (correct / partial / wrong) with rationale + source citation carried on the result; forfeit maps to 0 and is logged.
- [ ] Every completed answer path lands exactly one EvidenceRecord with node attribution via the evidence mutation; wrong answers auto-produce mistake entries; the session completes atomically (prior art: foundation repository tests).
- [ ] Mix mode interleaves open + choice in one session (the entity's mode field already carries it).
- [ ] Abandoned is a reachable terminal state via the exit path; an abandoned session is not resumable.
- [ ] No UI changes, no writes to the frozen scaffold progress context; gates green via direct `node_modules/.bin` binaries (`tsc -b`, eslint, `vitest run`).

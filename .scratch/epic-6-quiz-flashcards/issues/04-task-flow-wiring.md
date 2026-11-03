# T4: Task-flow wiring — task launches, real tiles, tasks-key invalidation (FR-37 parity; AD-6/8) — coupling tail

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-quiz-session-engine.md, 02-plan-flow-quiz-ui.md, 03-plan-flow-flashcards.md, epic-5 issues/02-task-home.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The first owner-mandated coupling tail, executed only after its blockers
clear: the task surfaces gain the same launches the plan flow already has.
Task Home's quiz and flashcard placeholder tiles (epic-5 T2's honest
placeholders) become real, enabled launches; `/task/:id/quiz` runs the
identical quiz loop against the task's single material, targeting the task's
single auto-owned Knowledge Node (AD-6: `planId` null, `taskId` set); 
`/task/:id/flashcards` studies the task material's cards the same way. When
evidence lands on a task node, the tasks query cache is invalidated — the
deferred slice-5 obligation — so Task Home's ring and Plans Home's Study
Tasks section update immediately, with no stale number anywhere. Twin-surface
parity is the point: nothing about the task loop is a lesser copy.

## Acceptance criteria

- [ ] Both task routes exist under the app layout (AD-8) and behave identically to their plan-flow twins (launcher states, attempt gate, grading, results, keyboard), scoped to the task's single material and its auto-owned node.
- [ ] Task evidence records attribute to the task's node (planId null), never a plan node — mastery never bleeds between plans and tasks (AD-6; epic-5 spec decision 2).
- [ ] Task Home's quiz/flashcard tiles are real and enabled; the placeholder disabled-with-reason state is gone.
- [ ] After a task quiz completes, Task Home's ring and Plans Home's Study Tasks section show the updated score without a stale cache (tasks-key invalidation verified in a test).
- [ ] i18n zh/en parity; semantic tokens only (AD-9); responsive correctness; tests cover the task-loop walk including the invalidation; gates green via direct `node_modules/.bin` binaries.

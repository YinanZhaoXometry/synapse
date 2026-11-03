# T1: Task creation flow — `/task/new`, upload → task + auto-node → land in Reader (FR-37; AD-6/7/8)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: none (can start immediately)

## Parent

[Epic 5](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

A learner with one document can start studying it without ever seeing plan UI
(FR-37, UJ-6). A new task creation page under the tasks feature module asks for
exactly one file (PDF or Markdown, ≤ 20 MB inclusive — the same validation seam as
plan attach) plus an optional name defaulting to the filename. Confirming
registers the Material against the task, creates the Study Task with its exactly
one auto-owned Knowledge Node (AD-6: `planId` null, `taskId` set, title from the
material), fires the eager parse through the reader's public parse API (AD-7), and
navigates straight to the reader route on the material — "lands in the Reader"
(UJ-6; route per AD-8). Parse failure never kills the task: the reader's existing
failed-card retry/re-upload is the recovery path.

## Acceptance criteria

- [ ] The creation route exists under the app layout; the page offers single-file upload accepting only PDF/Markdown ≤ 20 MB inclusive; other types and oversize are rejected bilingually with the reason (parity with plan-attach validation semantics).
- [ ] The name input pre-fills from the filename and is editable; confirming with a blank name falls back to the filename.
- [ ] On a valid upload: one Material is registered against the task, exactly one StudyTask is created owning exactly one auto KnowledgeNode (AD-6), and the user lands on the reader route for that material (UJ-6; AD-8).
- [ ] Parse runs eagerly via the reader's public parse API (AD-7); the reader's honest parse states apply unchanged (pending → parsing → parsed).
- [ ] On parse failure the task and material persist; the reader's failed card shows the bilingual reason with retry/re-upload — a corrupt file is a dead end for the file, not the task.
- [ ] All copy is new task-namespaced i18n keys with zh/en parity via the language context; semantic tokens only; sonner for toasts (AD-9).
- [ ] No writes to the frozen scaffold progress context; grandfathered scaffold pages untouched.
- [ ] Component render tests cover the page's observable states (idle / invalid-file rejection / creating); new pure logic unit-tested; gates green via direct `node_modules/.bin` binaries (`tsc -b`, eslint, `vitest run`).

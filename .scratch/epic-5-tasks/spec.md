# Spec: Epic 5 — Study Tasks, plan-free study (FR-37)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core

> Grill round closed 2026-11-03 — all 8 frontier questions accepted by recommendation
> (owner confirmed 「开始确认」; epic-2 precedent). Testing seams below follow that
> confirmation; no new seams are introduced.

## Problem Statement

A learner who just needs to crack one document — tonight's paper, a single lecture
PDF — is forced through plan ceremony. The only door into the study machinery
(Immersive Reader, Companion, Mastery Score) is creating a Study Plan and attaching
the material to it, so the product's own pitch "只想搞懂一份文档？不需要计划 — 直接开始"
(UJ-6) is unreachable. Meanwhile the Study Task plumbing shipped in the foundation
epic — the entity, its single auto-owned Knowledge Node (AD-6), the repository, the
task rollup — has zero UI consumers. The app's second, lighter door exists only as
types.

## Solution

A second, lighter entrance: a task creation page asks for exactly one thing — a
document (plus an optional name) — then registers the Material, creates the Study
Task with its single auto-owned Knowledge Node, and lands the learner directly in
the Immersive Reader, where the identical machinery (page-aware Companion, reading
position) already works from the reader epic. The task lives in the learner's
library: Plans Home gains a Study Tasks section (in both of its states) whose rows
carry the title, the single-node Mastery Ring, and a continue-reading link. Task
Home — the single-material twin of Plan Home — shows the honest single-node mastery
number with its evidence basis, and quiz/flashcard tiles as visible placeholders
pointing at the next slice, exactly like Plan Home's today. No plan UI ever appears.

## User Stories

1. As a learner with one document to study, I want to start a Study Task without creating a plan, so that I can study it with the full machinery immediately (FR-37, UJ-6).
2. As a fresh learner with no plans yet, I want the empty Plans Home to offer the Study Task path with the pitch 「只想搞懂一份文档？不需要计划 — 直接开始。」, so the direct path is visible from my very first visit.
3. As a returning learner, I want the create-task entry to persist alongside plan creation, so the task path never disappears once I have plans.
4. As a learner, I want to upload one PDF or Markdown file on the task creation page, so the task studies exactly the material I care about.
5. As a learner, I want unsupported file types and files over 20 MB rejected with a clear bilingual reason, so failures are explainable (20 MB inclusive — same semantics as plan attach).
6. As a learner, I want the material pre-named from the filename but editable before I start, so I don't have to rename anything later.
7. As a learner, I want task creation to auto-create the task's single Knowledge Node, so mastery has something to attach to without me building any structure (AD-6).
8. As a learner, after confirming creation I want to land directly in the Immersive Reader on my document, so nothing plan-like interrupts me (UJ-6: "lands in the Reader").
9. As a learner, I want an honest parse state while my document is processed (pending → parsing → parsed), so I am never told content is ready when it is not.
10. As a learner, if my document fails to parse, I want the task and material to still exist with a bilingual failure reason and retry/re-upload, so a corrupt PDF is a dead end for the file, not for the task.
11. As a learner, I want the page-aware Companion inside a task's Reader to behave exactly as in a plan, so plan-free study loses nothing (FR-37 identical machinery; FR-11/12).
12. As a learner, I want my reading position in a task's material tracked and restored, so continuing a task picks up where I stopped (FR-10).
13. As a learner, I want a Task Home showing my one material with an open-in-reader action, so the task has a stable home address beyond the reader.
14. As a learner, after a reload I want the task's material metadata to persist while the app tells me the file needs re-uploading, so session-only blobs never look like data loss.
15. As a learner, I want Task Home's Mastery Ring to show the task's own single-node score, so "how ready am I on this document" is one honest number (ADR-0001 — never a 0/50/100 collapse).
16. As a learner, I want the mastery state to use the shared vocabulary (uncovered / partial / mastered) with glyph and label — never color alone, so the number has a readable meaning.
17. As a learner, I want to inspect the evidence behind my task's score, so I can see exactly which quiz answers moved it.
18. As a learner, I want my task to appear on Plans Home under a Study Tasks section with its title and mastery ring, so my library holds both plans and standalone tasks (UJ-6 resolution).
19. As a learner, I want each task row to deep-link into the material at my last reading position, so re-entering a task is one click.
20. As a learner, I want the Study Tasks section to disappear when I have no tasks, so Plans Home never shows empty chrome.
21. As a learner, I want quiz and flashcard actions visible on Task Home but disabled with a reason pointing at the next slice, so I can see where the product is going without a dead click (parity with Plan Home).
22. As a learner, I want a breadcrumb from Task Home back to Plans Home, so the task never feels like a trap.
23. As a Chinese- or English-speaking learner, I want every new surface fully bilingual, so language never breaks the flow (AD-9).
24. As a learner in dark mode or another palette, I want all new surfaces built on semantic tokens, so nothing breaks in dark / sunset / twilight / aurora.
25. As a learner on a phone or tablet, I want the task surfaces to follow the app's responsive ladder, so plan-free study works on any screen.
26. As a learner, I want my task's score to move only from evidence on its own node, so plan mastery and task mastery never bleed into each other (AD-6).

## Implementation Decisions

1. **Epic-5/6 boundary.** Quiz/flashcard in-flow generation, evidence-recording UI,
   and the tasks-key cache invalidation in the evidence mutation belong to slice 6 —
   for both surfaces. This epic ships Task Home's tiles as honest placeholders
   (Plan Home precedent). Until slice 6, a new task's ring shows its real uncovered
   state; scores move only via repository-level evidence.
2. **PRD reconciliation (interpretation, no PRD edit).** FR-18/19 and the PRD
   glossary speak only of Study Plans; FR-37's "capabilities are identical to
   in-plan study of one Material" is the governing clause. This epic reads
   plan-scoped FRs as extended to Study Tasks, with the task's node per AD-6
   (`planId: null`, `taskId` set, exactly one, auto-created).
3. **New feature module `features/tasks`** (capability map row FR-37) owning the
   two new routes `/task/new` and `/task/:id` under the app layout (AD-8). The
   reader route is shared and unchanged. Dependency direction pages → features →
   {domain, data, ai}; no new domain contexts (AD-2).
4. **Creation sequence.** Validate upload (PDF/Markdown, ≤ 20 MB inclusive — the
   same validation seam as plan attach) → register the Material against the task
   (parse pending) → create the Study Task (auto node titled from the material) →
   eager parse through the reader's public parse API → navigate to the reader route.
   Parse failure leaves task + material intact; the reader's failed-card
   retry/re-upload is the recovery path.
5. **Task Home composition.** Breadcrumb to Plans Home; material row (open reader;
   re-upload when bytes are lost after reload); Mastery Ring + state glyph + label +
   EvidencePopover driven by pure display-shaping selectors over the task's single
   node; two placeholder tiles (quiz, flashcards) disabled with a reason. No upload
   zone — a task is strictly 1:1 with its material (`StudyTask ||--|| Material`).
6. **Plans Home integration.** Both states gain the create-task entry; the empty
   state adds the pitch line; a Study Tasks section renders when ≥ 1 task exists —
   rows: title, single-node ring, continue-reading link, newest first. The entry
   decision (where `/` lands) is unchanged.
7. **Data layer: no changes.** The StudyTask entity, task repository (auto-node
   creation, material back-link), query keys, and task/material hooks shipped in
   the foundation epic are consumed as-is. The frozen scaffold progress context
   receives no writes.
8. **Conventions.** All new copy under task-namespaced i18n keys with zh/en parity
   via the language context; semantic tokens only (glass/accent-tint tokens, never
   hardcoded whites/corals); sonner for toasts (AD-9).
9. **Mastery display exclusively through the domain seam.** Task rollup =
   `computeTaskRollup` (the single owned node's score), states via `getNodeState`,
   evidence via the existing evidence queries (AD-6, ADR-0001). No surface computes
   its own numbers.

## Testing Decisions

- A good test asserts external behavior only: exact ADR-0001 numbers (window 5,
  cap-99 below the evidence gate, mastered = ≥ 80 & ≥ 3), routing outcomes, honest
  state transitions, bilingual copy keys — never internal component state, and no
  duplicated display arithmetic.
- **Seams (all existing — none added):**
  1. Data/repository seam — task, material, and quiz repositories (prior art:
     the shipped task-repository tests and the evidence-loop walk).
  2. Pure display-shaping seam — new selectors in the tasks feature tested against
     repository-shaped inputs (prior art: the plans feature's display-shaping tests).
  3. Integration-walk seam — one task-loop walk at repository + session-blob level
     (prior art: evidence-loop and reader-loop integration tests).
  4. Component render seam — jsdom render tests for the new surfaces' observable
     states (prior art: reader and plans component tests).
- Gates run via direct `node_modules/.bin` binaries (`tsc -b`, eslint, `vitest run`)
  — the pnpm-layout environment breaks `npm run`.

## Out of Scope

- Quiz/flashcard in-flow generation and evidence-recording UI (epic-6; includes the
  tasks-key invalidation in the evidence mutation).
- Study Task → Plan promotion (FR-37 stretch half — Phase 2, a pointer not a build).
- Task rename/delete; Today-hub integration (FR-27 is Phase 2 and its "tasks" are a
  different concept — day-planner items, not Study Tasks); multi-material tasks.
- MaterialsPage and any other grandfathered scaffold page (PlannerPage untouched per
  the gap analysis; their realization belongs to the small-tail slice's evaluation).
- Onboarding and entry-decision changes; any backend work (AD-12..20 is Phase 2).

## Further Notes

- **Demo honesty for Nov 6:** the UJ-6 quiz step (task shows its own Mastery Score
  after a Mix quiz) completes only when slice 6 lands; epic-5 alone shows the real
  uncovered state with the machinery one tile away. If the demo needs a moving
  number, schedule slice 6 before the demo or record evidence via the repository.
- **Epic-4 resolution:** the parallel companion epic was superseded by the reader
  epic's merged delivery (FR-11/12 shipped there; its routing fix is already on
  main). Epic-5 has no open dependencies — the slicing table's "reader blocks
  tasks" edge is satisfied.
- **UX reference:** the spine has no task mockup; the binding references are the IA
  table rows (create `/task/new`, home `/task/:id`), the UploadDropzone /
  QuizLauncher / MasteryRing component contracts, the empty-state and
  task-complete-ish state patterns, the microcopy pitch line, and the UJ-6 flow.

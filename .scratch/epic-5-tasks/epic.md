# Epic 5 — Study Tasks, plan-free study (FR-37)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core

## Parent

Spec: [spec.md](spec.md) (grill round closed 2026-11-03, all 8 recommendations
adopted — owner confirmed 「开始确认」). Bound by the architecture spine
(AD-2/3/6/7/8/9/10), ADR-0001, the UX spine (EXPERIENCE.md IA table — no task
mockup exists), GLOSSARY.md, and the PRD Phase-1 slice.

## Scope note (slice 5 of the phase-1 table)

The slicing table's "reader blocks tasks" edge is satisfied (reader shipped in
epic-3; the parallel epic-4 was superseded by that merged delivery, its routing fix
already on main). The backend plumbing pre-exists from epic-1 — StudyTask entity,
task repository with auto-node creation (AD-6), query keys, `computeTaskRollup` —
so this epic is the UI/route/i18n shell over it, deliberately stopping at the
epic-5/6 boundary: quiz/flashcard generation, evidence-recording UI, and the
tasks-key cache invalidation belong to slice 6 (Plan Home placeholders are the
precedent).

## What to build

A `features/tasks` module with two routes: the creation flow `/task/new` (upload
one PDF/Markdown via the shared validation seam, optional name defaulting to the
filename, register → create task with its single auto-node → eager parse via the
reader's public parse API → land in the Reader, UJ-6) and the Task Home
`/task/:id` (single-material twin of Plan Home: breadcrumb, material row with
open-in-reader and re-upload, single-node Mastery Ring + EvidencePopover via pure
display-shaping selectors, honest placeholder tiles for quiz/flashcards). Plans
Home gains the create-task entry in both states, the empty-state pitch line, and a
Study Tasks section (title + single-node ring + continue-reading link) when tasks
exist. Grandfathered scaffold pages untouched.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-task-create-flow.md](issues/01-task-create-flow.md) | — | `/task/new` creation flow: upload → name → task + auto-node → eager parse → land in Reader (FR-37; AD-6/7/8) |
| 2 | [02-task-home.md](issues/02-task-home.md) | 1 | `/task/:id` single-material twin of Plan Home: ring, evidence, re-upload, placeholder tiles (FR-37; AD-6/8) |
| 3 | [03-plans-home-task-section.md](issues/03-plans-home-task-section.md) | 2 | Plans Home task section + create-task entries in both states + pitch copy (FR-37; AD-8/9) |
| 4 | [04-gates-integration-walk.md](issues/04-gates-integration-walk.md) | 2, 3 | task-loop integration walk, responsive/theme/i18n pass, gates, epic close (AD-9/10) |

## Definition of done

FR-37 acceptance (a Study Task's capabilities identical to in-plan study of one
Material, no plan UI required to reach them; the stretch promotion half excluded —
Phase 2) · gates green (`npx tsc -b`, `npm run lint`, `npm run test` — AD-10, run
via direct `node_modules/.bin` binaries) · grandfathered scaffold surfaces
untouched (Materials/Planner/Quiz/Dashboard stay demo) · every ticket cites its AD
ids · new UI verified in light + dark × sunset/twilight/aurora ×
desktop/tablet/mobile.

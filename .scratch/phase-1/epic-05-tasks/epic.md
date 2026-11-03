# Epic 5 — Study Tasks, plan-free study (FR-37)

Status: done
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

## Closure (2026-11-03)

Shipped T1–T4 (`eb23aa4` → `036f7b5`) + review-fix pass (`3d709eb`). Two-axis
review (spec-conformance + standards): **0 × P0, 1 × P1, 9 × P2 — the P1 and 4
P2s fixed** in `3d709eb` (Task Home material row clipped the re-upload controls
at 390px — row now wraps, secondary chips drop at phone widths; orphan Material
left registered when task creation failed mid-flow — retry now reuses the
registered material; internal IDs leaked into user copy (「ADR-0001」/「epic-6」/
「slice 4」) — plans + tasks copy rewritten, meaning kept; empty-state stray div).
Spec axis: all 26 user stories, 9 implementation decisions, and the 4 pre-agreed
test seams verified true; tickets' claimed ACs all genuine.

**Deferred follow-ups** (deliberate, non-blocking): extract the shared
MaterialRow + re-upload protocol (now in three features — plans/reader/tasks;
next protocol change is shotgun surgery); reuse the plans `latestReading`
locator→sectionId mapping inside `taskContinueTarget`; `plans.sliceCompanion`
still says "slice 4" (same leak class, found post-fix); `OutcomeMark` vs
GLOSSARY's Outcome avoid-term (grandfathered plans atom); Task Home's 「继续阅读」
label links plain when no anchor resolves (within spec, slight over-promise).
Browser smoke: a malformed persisted ReadingPosition crashed the Plans Home tree
— epic-5's selector guards missing data correctly; the whole-tree exposure is the
scaffold-wide no-error-boundary posture, not an epic-5 defect. 283/283 tests
(36 files), tsc/eslint clean (10 pre-existing scaffold warnings); visual smoke
2026-11-03 at 1440×900 / 390×844 × light+sunset / dark+twilight. Note: the
branch also carries `8b2c895` (epic-6 spec-chain docs from the parallel planning
session) — docs-only, flows to main with this merge.

# T6: Integration walks, responsive/theme/i18n sweep, gates, epic close (AD-9/10)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 04-task-flow-wiring.md, 05-quiz-page-repoint.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's verification and close (epic-3/epic-5 precedent). Two integration
walks at repository + session level: the plan loop (material attached →
generate → answer across modes → evidence → mastery movement visible through
the domain seam) and the task loop (task quiz → evidence on the task node →
ring updates everywhere via the invalidation). A full sweep of every new
surface — quiz launcher/runner/results, flashcards study, task variants,
re-pointed `/quiz` — across the responsive ladder (desktop/tablet/mobile) and
light + dark × sunset/twilight/aurora, an i18n zh/en parity pass with sonner
as the only toast pattern, then all gates green and the tracker closed with
deferred follow-ups recorded.

## Acceptance criteria

- [ ] Plan-loop integration walk passes (material → generate → answer → evidence → movement; ADR-0001 numbers asserted exactly).
- [ ] Task-loop integration walk passes (task quiz → task-node evidence → Plans Home + Task Home freshness via invalidation).
- [ ] Every new surface verified in light + dark × sunset/twilight/aurora × desktop/tablet/mobile; i18n zh/en parity sweep clean; sonner-only toasts.
- [ ] Gates green via direct `node_modules/.bin` binaries (`npx tsc -b`, eslint, `vitest run`) — never `npm run`.
- [ ] Epic closed in the tracker: tickets marked done, deferred follow-ups (multi-select choice, SRS/re-queue FR-24, hubs FR-41/42, Mistakes Notebook FR-23, node-level scope) recorded with their Phase-2 pointers.

# T4: Task-loop integration walk + responsive/theme/i18n pass + gates + epic close (AD-9/10)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-task-home.md, 03-plans-home-task-section.md

## Parent

[Epic 5](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's verification pass. One task-loop integration walk at the repository +
session-blob seam proves the full chain without epic-6's UI: create task → attach
bytes → eager parse → reading-position save → repository-level quiz generation,
session creation, and evidence recording against the task's node → exact ADR-0001
numbers on the task rollup → reload simulation from the same localStorage key.
Then the sweep: responsive ladder for the three new surfaces, light + dark across
the three palettes, i18n parity, grandfathered-surface checks — and the gates.

## Acceptance criteria

- [ ] Task-loop integration walk passes (prior art: evidence-loop / reader-loop walks), asserting exact ADR-0001 numbers on the task rollup — including cap-99 below the evidence gate and mastered at ≥ 80 & ≥ 3 — and that task evidence never moves plan scores (AD-6 isolation).
- [ ] The walk's reload simulation restores task, node, material metadata, reading progress, and evidence from the persisted document.
- [ ] Responsive ladder verified for the creation page, task home, and the Plans Home section at desktop/tablet/mobile breakpoints; light + dark × sunset/twilight/aurora all render correctly.
- [ ] i18n sweep: no hardcoded user-facing strings in the new feature; zh/en parity across every new key (AD-9).
- [ ] Grandfathered check: scaffold pages untouched; frozen progress context unwritten (grep-level verification).
- [ ] Gates green via direct `node_modules/.bin` binaries — `tsc -b`, eslint, `vitest run` (pnpm layout; `npm run` is broken in this environment).
- [ ] Epic closure section written in the epic doc (shipped tickets, fixes, deferred follow-ups — epic-3 format).

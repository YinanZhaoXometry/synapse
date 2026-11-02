# T2: Plans Home + creation chat — topic → streamed structure → confirmed plan (FR-1)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-front-door-wiring.md

## Parent

[Epic 2](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The front door itself (FR-1, Q3/Q4/Q5). Empty state: an agent-style creation chat is the primary surface — required topic + optional free-text goal (no Phase-2 chips) streams the Companion's plan-structure proposal (shipped simulated service, deterministic, zh/en), resolves into a stage-grouped structure card, supports inline node rename and regenerate, and confirming maps the proposal into the plan repository's create call (persisted via the existing mutation hooks) and navigates to Plan Home. Returning state: continue hero for the most recent plan (rollup + recency; no reading-position line yet), plan cards with honest rollup chips and a node-state mini bar, and a create-new action that opens the same creation flow. No task section (slice 5), no seeded demo data — the empty state is the demo (SM-1). The proposal→create-input mapping is a pure function, tested.

## Acceptance criteria

- [x] With no plans: Plans Home shows the creation chat; typing a topic + optional goal streams the proposal live and resolves to a stage-grouped structure card (FR-1; AD-5)
- [x] Nodes rename inline before commit; regenerate re-proposes from the same topic/goal (Q4)
- [x] Confirm creates a real persisted StudyPlan + KnowledgeNodes (renames applied, goal persisted when given) via the plan repository and lands on that plan's Plan Home with attach-materials as the next step (AD-3/AD-4)
- [x] With plans: continue hero (most recent plan + rollup) + plan cards (rollup chip, node-state mini bar, node/material counts) + create-new action reaching the creation flow (Q5)
- [x] Plans Home shows no task section and no demo seed data (Q3/Q5)
- [x] Proposal→create-input mapping is a pure function with vitest coverage: rename application, stage grouping, goal passthrough, empty-proposal rejection (Q8)
- [x] Rollup chips/mini bars read from the shipped domain functions — uncovered counts 0; no display arithmetic (ADR-0001, AD-6)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched (AD-9)

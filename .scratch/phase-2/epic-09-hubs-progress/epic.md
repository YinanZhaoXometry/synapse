# Epic 9 (Phase 2) — Hubs + progress surfaces: real data behind the retained pages

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff; gate: epics 07+08 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-23/26/27/28/41/42 + FR-25 Phase-2 halves ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · UX spines ([EXPERIENCE.md](../../../docs/design/ux-synapse/EXPERIENCE.md)) · AD-9 (bilingual/accessibility floor), AD-14 (rollups server-side), AD-8 (routes) · [spec.md](spec.md). Completes the `UserProgressContext` retirement (epic-08 A1).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-hub-read-model.md](issues/01-hub-read-model.md) | — (epic gate) | api aggregation queries: mistakes/today/histories/analytics/goal/badges |
| 2 | [02-mistakes-hub.md](issues/02-mistakes-hub.md) | 1 | `/mistakes` re-point (FR-23) |
| 3 | [03-today-hub.md](issues/03-today-hub.md) | 1 | 今日学习 daily list, dues + manual v1 (FR-27) |
| 4 | [04-flashcards-quiz-hubs.md](issues/04-flashcards-quiz-hubs.md) | 1 | `/flashcards` + `/quiz` hubs, retake = fresh evidence (FR-41/42) |
| 5 | [05-analytics-dashboard.md](issues/05-analytics-dashboard.md) | 1 | `/analytics` + `/dashboard` re-point + weekly goal (FR-26/25) |
| 6 | [06-achievements.md](issues/06-achievements.md) | 1 | real badge unlocks, 12-badge taxonomy (FR-28) |

## Definition of done

All four sidebar hubs + three progress pages render real, user-scoped evidence · retakes produce fresh evidence · 今日学习 label rule holds · every surface bilingual + theme-complete · `UserProgressContext` deleted with grep-guard · web+api gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epics 07+08 done** (07 only for T3's due items — if 07 slipped, T3 ships dues-less and re-gates).
- T2–T6 parallelize after T1 (two-builder practical max; T3 and T5 are the chunkiest).
- Badge thresholds + Today suggestions heuristic are the delta-grill items — resolve before T1 freezes the read model.

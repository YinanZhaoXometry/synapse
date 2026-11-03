# Epic 14 (Phase 2) — Small tail: Settings account surfaces, Task→Plan promotion, ops hardening

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff; gate: epic-08 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-37 stretch half, FR-30/34 surfaces ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · EXPERIENCE "later" Settings list · spine **AD-15** (account mechanics), **AD-16** (cap counter), **AD-20** (demo-window posture) · Deferred-table ops rows · [spec.md](spec.md). Closes Phase 2.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-settings-account.md](issues/01-settings-account.md) | — (epic gate) | password change, data export (import-shaped), cap display, weekly-goal set |
| 2 | [02-task-plan-promotion.md](issues/02-task-plan-promotion.md) | — (parallel) | promote Study Task → Study Plan, evidence continuity (FR-37 stretch) |
| 3 | [03-ops-hardening-registry.md](issues/03-ops-hardening-registry.md) | — (parallel) | error visibility (demo window), Neon backups decision, password-reset mail gate, OAuth registry |

## Definition of done

All four Settings surfaces live · promotion preserves scores/evidence (spec-proven) · every T3 registry item shipped or trigger-recorded · gates green · **Phase-2 §6.2 diff check re-run at close** (roadmap final item).

## Coordination notes

- **Gate: epic-08 done**; fully parallelizable with 09–13 (small, low-collision).
- Export shape pairs with epic-08-T3's import — shape changes go through both tickets' Comments.
- Closing this epic + the diff check = Phase 2 feature-complete; anything surviving goes back to the spine's Deferred table with fresh triggers.

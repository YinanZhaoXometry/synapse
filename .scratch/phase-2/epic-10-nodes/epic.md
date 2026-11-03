# Epic 10 (Phase 2) — The node layer: mapping, pinning, states, roadmap graph, adaptive targeting

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff — renderer OQ-2, targeting weights, mapping UX; gate: epic-08 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-44/45/21/5/6/7 + FR-18's node-targeted half ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.1) · owner Q5(a) skeleton/flesh ruling · AD-6/14 (one score source), AD-7/8 (reader anchor channel), AD-16 (targeting is generation input) · [spec.md](spec.md). Carries the PRD-audit true gaps (FR-44/45).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-material-node-mapping.md](issues/01-material-node-mapping.md) | — (epic gate) | AI section→node mapping + proposed-node confirmation flow (FR-45) |
| 2 | [02-node-pinned-attach.md](issues/02-node-pinned-attach.md) | 1 | attachment scope (plan\|node), scoping enforced in generation context (FR-44) |
| 3 | [03-node-states-clickthrough.md](issues/03-node-states-clickthrough.md) | 1 | mastery-driven node states + reader/QuickTest click-through (FR-6/7) |
| 4 | [04-roadmap-graph.md](issues/04-roadmap-graph.md) | 3 | interactive stage-grouped graph, 30+ node bar, renderer per delta-grill (FR-5, OQ-2) |
| 5 | [05-adaptive-targeting.md](issues/05-adaptive-targeting.md) | 1, epic-05 | low-mastery + mistakes bias on generation; FR-18 node-targeted half (FR-21) |

## Definition of done

Every attached section maps or proposes (nothing silently dropped) · pinned content provably scoped · node states live on real scores · graph usable at 30+ nodes in both themes · generation biases per recorded weights · all gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epic-08 done.** Biggest post-cutover epic — start it first per the roadmap's risk ordering.
- T4's renderer spike may start early (parallel with T1–T3); T4 lands after T3.
- **Epic-12 depends on T1** (plan-level grounding uses section→node mapping); **epic-09-T3's suggestion slot consumes T5** (re-gate if ordering flips).

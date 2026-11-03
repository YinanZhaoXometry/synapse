# Epic 12 (Phase 2) — Notes with enrichment + plan-level Companion

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff — OQ-11 sourcing; gate: epics 08+10 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-40/22/46, UJ-5 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · spine AD-16 (one SSE surface; adapter; cap), AD-5 (contract; features never raw-call AI), capability-map row "FR-46 + FR-44/45 node-scoped grounding" · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-note-generation.md](issues/01-note-generation.md) | — (epic gate) | generateNote(scope) + Note entity + enrichment placement + export (FR-40) |
| 2 | [02-weak-spot-notes.md](issues/02-weak-spot-notes.md) | 1 | targeting: weakSpot variant via epic-10 (FR-22) |
| 3 | [03-plan-level-companion.md](issues/03-plan-level-companion.md) | — (needs epic-10 mapping) | plan-scope chat + citations + analyze-my-mistakes + /ai-tutor re-point (FR-46) |

## Definition of done

Notes generate/export for all three scopes with enrichment markers honored · weak-spot bias proven on crafted scores · plan-chat cites material+section without a Reading Position · mistake analysis grounded in the item's source · /ai-tutor on real grounding · gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epics 08+10 done** (mapping feeds plan-grounding + the weak-spot variant). T1 can start the Note entity + scope plumbing the moment 08 lands — only enrichment + T2/T3 need 10.
- Reuses epic-05's stream op (plan grounding mode) — contract additions go through epic-05's frozen-contract note, surfaced not absorbed.

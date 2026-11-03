# Epic 11 (Phase 2) — External plans: Square + roadmap.sh import

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff — license, surface placement; gate: epic-08 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-38/39/43 + OQ-12 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · spine **AD-13** (the single public-read exception — structure only, NFR-7; fork with attribution; import as build-time job) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-plan-visibility.md](issues/01-plan-visibility.md) | — (epic gate) | visibility set/change flows (FR-38) |
| 2 | [02-square-read-path.md](issues/02-square-read-path.md) | 1 | public-plan list/preview queries, reduced type set, public scope context (FR-39 api half) |
| 3 | [03-square-ui-fork.md](issues/03-square-ui-fork.md) | 2 | browse/preview/adopt surface + structure fork w/ attribution (FR-39 web half, OQ-12) |
| 4 | [04-roadmapsh-import.md](issues/04-roadmapsh-import.md) | — (parallel; license gate) | build-time fetch/parse job → plan, attribution + license (FR-43) |

## Definition of done

Public reads structurally cannot expose Materials/Annotations/Mastery (reduced types, asserted) · Private flip removes from Square · fork produces an independent attributed plan · one roadmap.sh import round-trip recorded with license note · gates green · every ticket cites FRs + AD-13.

## Coordination notes

- **Gate: epic-08 done**; mostly api-side → parallelizes with 09/10/13 (T4 is api-only + license-gated — start it whenever the license check clears).
- T1 uses epic-01's `visibility` column — no migration expected; if a field is missing it goes here, noted in Comments.
- Surface placement (sidebar vs plans-home) is a delta-grail UX call — confirm against the UX spine before T3.

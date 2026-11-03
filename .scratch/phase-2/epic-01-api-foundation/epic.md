# Epic 1 (Phase 2) — API foundation: command core, error contract, the full ER

Status: done (2026-11-04 — branch epic/p2-1-api-foundation @ c0c89b0, CI green run 41690050139, two-axis review 0P0/2P1/7P2 all fixed, merged to main same day)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane A · spine [architecture-synapse.md](../../../docs/architecture/architecture-synapse/architecture-synapse.md) **AD-12** (command core, closed error enum), **AD-13** (the spine ER, user scoping), **AD-10** (RSpec posture) · [spec.md](spec.md). Everything server-side (02–08) depends on this epic.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-command-core.md](issues/01-command-core.md) | — | `ApplicationCommand` base, never-raise Failures, closed error enum + GraphQL presenter, demo command |
| 2 | [02-er-migrations.md](issues/02-er-migrations.md) | 01 | users + full spine ER migrations (uuid, user-scoped, visibility, annotations), strong_migrations |
| 3 | [03-factories-scoping.md](issues/03-factories-scoping.md) | 02 | factory_bot factories + the shared user-scoping RSpec context (FR-4 isolation on every model) |

## Definition of done

`just spec` api gates green · scoping context covers every user-owned model · `schema.graphql` still health-only · rubocop clean · every ticket cites AD ids · no GraphQL entity surface, auth, AI, storage, or queue code present.

## Coordination notes

- **Gate: epic-00 done** — this epic builds on the scaffold's compose/RSpec/rubocop base.
- Tickets are strictly ordered (1 → 2 → 3); no intra-epic parallelism worth a branch.
- Epics 04 (mastery) and 06 (storage) open the moment this epic closes — three lanes per the roadmap. 02 (auth) starts on this epic's ticket 2 shape-stability, not its close.
- Field-level ER decisions beyond the spine's names+ownership get recorded in ticket 2's Comments for epic-03/04 to consume.

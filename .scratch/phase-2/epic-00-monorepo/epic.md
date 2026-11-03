# Epic 0 (Phase 2) — Monorepo restructure: `web/` + `api/` + justfile + CI (Phase-2 opener)

Status: done (2026-11-03 — all 5 tickets implemented + two-axis review fixed on branch epic/p2-0-monorepo @ 96eb1ea; merged to main 2026-11-03 at owner direction)
Milestone: Phase 2 — post-deadline

## Parent

The architecture spine's Deferred-table row "Monorepo restructure → Phase-2 epic-0" and the Capability map row (both [architecture-synapse.md](../../../docs/architecture/architecture-synapse/architecture-synapse.md)), bound by **AD-17** (two apps, one contract, one entrypoint) with AD-12 (api architecture), AD-19 (jobs posture), AD-20 (deployment envelope). Full spec chain run 2026-11-03: `/grill-with-docs` (one round, three questions, resolved by standing delegation — [spec.md](spec.md) assumption log) → `/to-spec` → `/to-tickets` (this doc + 5 tickets). Spine constraint honored: **design now, implementation post-Nov-6** — the Nov-6 demo runs on the untouched static build. *(Superseded 2026-11-03, owner direction: implemented early on the integration branch, merged to `main` the same day — the demo runs from the monorepo layout with unchanged behavior, 411/411 + CI green; owner also confirmed Cloudflare Pages was never configured, voiding the Q3=b sequencing.)*

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-web-move.md](issues/01-web-move.md) | — | SPA wholesale into `web/`, zero behavior change, 4 gates green unmodified, `.nvmrc` pin |
| 2 | [02-api-scaffold.md](issues/02-api-scaffold.md) | — | bootable Rails 8.1 api (compose postgres+api), health query, committed `schema.graphql`, rubocop+rspec green |
| 3 | [03-justfile-codegen.md](issues/03-justfile-codegen.md) | 01, 02 | root justfile `setup/dev/up/spec`; web codegen proves the contract pipeline |
| 4 | [04-ci-actions.md](issues/04-ci-actions.md) | 01, 02 | GitHub Actions: web gates + api gates on push/PR to main |
| 5 | [05-docs-pass.md](issues/05-docs-pass.md) | 01, 02 | AGENTS.md ×2 (root rewritten + api contract authored), deploy doc re-point, README un-stubbed |

Tickets 1 and 2 are independent and could run in parallel lanes; the epic lands as a **single integration branch** off main (wide-refactor rule — the move's blast radius is repo-wide, green is promised at the branch level), worked in ticket order with two-axis review before merge.

## Definition of done

Every ticket's ACs ticked · `just spec` green end-to-end from the merged layout · CI green on the integration branch pre-merge · two-axis review (spec-conformance + defects) run and fixes landed · **zero web behavior change** (411/411 unmodified is the regression bar) · `api/` contains exactly the scaffold scope (02's scope guard) · every ticket cites its AD ids · root docs describe reality (pnpm toolchain, true storage keys).

## Coordination notes

- **CF Pages sequencing (Q3=b):** the owner configures Cloudflare Pages *this week* against the **current** layout per [docs/deploy.md](../../../docs/deploy.md) (epic-7 T1, ready-for-human). After this epic merges, the owner edits the Pages project's root directory once (`web`) — ticket 05 re-points the doc and carries that note. **Superseded 2026-11-03:** owner confirmed Pages was never configured — no re-point step; deploy.md now instructs fresh configuration with root `web`.
- **Not in this epic:** any api business code (backend feature epics own those, one spec chain each), Apollo swap (cutover epic, AD-18), minio (joins with ActiveStorage/R2 — A7), Solid Queue gem (first named job — A9).
- **Remote:** origin re-pointed to `github.com/YinanZhaoXometry/synapse` on 2026-11-03 (the standing set-url recommendation; old remote still pushable).
- **Folder rename (2026-11-04, owner direction):** after merge, `web/`+`api/` were renamed `frontend/`+`backend/` (branch `epic/p2-0-monorepo-rename`, gates + CI green) — this epic's ticket bodies keep the original `web/`/`api/` names as the historical record.
- **Naming:** this epic's dir moved twice on 2026-11-03 — `epic-0-monorepo` → `epic-p2-0-monorepo` (phase visible at a glance) → **`.scratch/phase-2/epic-00-monorepo/`** (owner-approved two-level phase-first layout; convention in [workflow.md](../../../docs/agents/workflow.md) §Managing delivery phases & epics). The spine's name for it stays "Phase-2 epic-0".

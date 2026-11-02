# Epic 1 — foundation (domain core + data/ai seams)

> Migrated from GitHub issue #7 (closed 2026-11-02) when the tracker moved to local markdown. Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/7

Status: done

## Parent

Spec: [spec.md](spec.md) (GitHub #6). Bound by the architecture spine (AD-1…AD-11, final 2026-11-02), ADR-0001 (mastery computation), GLOSSARY.md, and the PRD memlog 2026-11-02 grill outcomes (owner accepted all recommendations).

## What to build

The three seams + domain core before any UI: the pure **domain** module (entity types + the one mastery function + evidence-day streak), the **data** module (repositories over the single `synapse-db:v1` local store + TanStack Query hooks), and the **ai** module (CompanionService + deterministic simulated implementation). Every later epic consumes these unchanged. This epic ships zero UI and ends with an integration slice proving the evidence loop end-to-end.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-domain-core.md](issues/01-domain-core.md) (GitHub #8) | — | the number means one thing (ADR-0001) |
| 2 | [02-local-store-plans-nodes.md](issues/02-local-store-plans-nodes.md) (GitHub #9) | 1 | plans persist; TanStack Query starts being used |
| 3 | [03-material-task-repos.md](issues/03-material-task-repos.md) (GitHub #11) | 2 | session-only blobs; task auto-node; reading/chat persist |
| 4 | [04-evidence-loop-repos.md](issues/04-evidence-loop-repos.md) (GitHub #12) | 2 | quiz answers become node-attributed evidence |
| 5 | [05-companion-service-chat-plan.md](issues/05-companion-service-chat-plan.md) (GitHub #10) | 1 | the AI seam — grounded, guardrailed, bilingual |
| 6 | [06-generation-grading.md](issues/06-generation-grading.md) (GitHub #13) | 5 | materials-sourced, node-attributed questions |
| 7 | [07-integration-evidence-loop.md](issues/07-integration-evidence-loop.md) (GitHub #14) | 3, 4, 6 | plan → material → quiz → evidence → mastery holds |

Two parallel lanes open after slice 1: data (2 → 3 ∥ 4) and ai (5 → 6); slice 7 closes the epic.

## Definition of done

FR acceptance for the epic's scope · gates green (`npx tsc -b`, `npm run lint`, `npm run test`) · grandfathered scaffold surfaces untouched · every ticket cites its AD ids (`docs/agents/workflow.md`).

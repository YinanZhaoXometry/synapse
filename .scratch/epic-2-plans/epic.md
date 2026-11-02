# Epic 2 — Study Plans, the front door (FR-1 · FR-2 · FR-25)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core

## Parent

Spec: [spec.md](spec.md) (grill round closed 2026-11-02, all recommendations accepted). Bound by the architecture spine (AD-2/3/4/5/6/7/8/9), ADR-0001 (mastery computation), the UX spines (DESIGN/EXPERIENCE), GLOSSARY.md, and the PRD Phase-1 slice.

## What to build

The first UI consumer of the epic-1 seams: the plan-first entry chain. Onboarding happens once (flag persisted, previously unwired), then `/` lands on **Plans Home** — agent-style creation chat when empty (topic + optional goal → streamed staged structure → rename → confirm → real persisted plan), continue hero + plan list when plans exist. **Plan Home (light)** shows the honest mastery rollup and per-node evidence basis, attached Materials with parse-pending states, the evidence-day streak, recent activity (real-query shell), and quick actions disabled with reasons. Uploading a Material registers it against the plan (PDF/Markdown ≤ 20 MB, session-only blob, no parsing — that is the Reader's slice).

UI reference: prototype branch `prototype/epic-2-plans-ui` (`6d2877c`), **Variant A binding**; B/C recorded alternatives.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-front-door-wiring.md](issues/01-front-door-wiring.md) | — | onboarding once, then the front door: entry guard + routes + nav re-point |
| 2 | [02-plans-home-creation.md](issues/02-plans-home-creation.md) | 1 | topic → streamed structure → confirmed persisted plan (FR-1) |
| 3 | [03-plan-home-light.md](issues/03-plan-home-light.md) | 2 | honest mastery + node list + activity shell + quick actions (FR-25) |
| 4 | [04-material-attach.md](issues/04-material-attach.md) | 3 | dropzone → registered pending-parse Material (FR-2) |

Linear chain this time — every slice renders on the previous one's surface; nothing worth parallelizing at this size.

## Definition of done

FR-1/2/25 acceptance · gates green (`npx tsc -b`, `npm run lint`, `npm run test`) · grandfathered scaffold surfaces untouched (Dashboard stays demo; quiz page's hardcoded deltas untouched) · every ticket cites its AD ids (`docs/agents/workflow.md`) · prototype gate dropped from main once winners are folded in.

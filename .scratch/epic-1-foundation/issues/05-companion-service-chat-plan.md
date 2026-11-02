# T5: CompanionService interface + simulated grounded chat & plan proposal

> Migrated from GitHub issue #10 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/10

Status: done
Blocked by: 01

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The AI seam: the CompanionService interface — streamed emission, structured response contract (intent, rung, citations) — and its deterministic simulated implementation for grounded chat and plan-structure proposal. Chat answers ground on a ReadingPosition, cite the source location, follow the hint-first ladder with escalation always reachable, and fall back honestly when the position can't answer (NFR-1). Plan proposal picks from the curated template library (software-engineering default + generic 4-stage fallback), 8–12 nodes, deterministic per topic. Replies arrive in the caller's active UI language.

## Acceptance criteria

- [x] Interface + simulated adapter behind it; no other module reaches AI behavior except through the service (AD-5)
- [x] Grounded chat cites the ReadingPosition source; an ungroundable question yields the explicit honest-fallback response — tested
- [x] Every response carries the structured contract (intent + rung + citations); escalation stays reachable — tested
- [x] Plan proposal: same topic → identical structure; 8–12 nodes across 3–4 stages; streamed emission — tested
- [x] Simulated replies exist in zh and en and switch with the language parameter — tested
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-5, AD-9, EXPERIENCE.md · AI Behavior & Guardrails.

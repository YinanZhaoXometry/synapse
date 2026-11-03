# Epic 8 (Phase 2) — The cutover: Apollo, login wall, import, SSE client, retirement, deploy

Status: ready-for-agent (spec + tickets 2026-11-03; **gate: epics 02+03+04+05+06 all done** — merge point, single integration branch)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) merge point · spine **AD-18** (Apollo 4 + codegen hooks own domain data; simulated AI → dev/test double; auth change resets cache + kills SSE), **AD-15** (login wall; one-time import; client-side logout), **AD-20** (deploy envelope + rehearsed rollback), **AD-16-web** (SSE client: no reconnect, restart, language), **AD-14-web** (client renders server scores) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-apollo-swap.md](issues/01-apollo-swap.md) | — (epic gate) | Apollo Client 4 + typed hooks replace TanStack/repositories; auth-change cache reset |
| 2 | [02-login-wall.md](issues/02-login-wall.md) | 1 | /login /register, token wiring, route guard, demo entry, logout semantics |
| 3 | [03-first-login-import.md](issues/03-first-login-import.md) | 2 | synapse-db:v1 one-shot idempotent import + re-attach invite; local doc never deleted |
| 4 | [04-sse-client.md](issues/04-sse-client.md) | 1 | EventSource wrapper: fresh-ticket restart, cap notice, terminal-code mapping, language param |
| 5 | [05-ai-seam-swap.md](issues/05-ai-seam-swap.md) | 1, 4 | CompanionService server adapter behind the seam; simulated → dev/test double; AppError map; goal-selection (A3) |
| 6 | [06-deploy-rollback.md](issues/06-deploy-rollback.md) | 1–5 | Render + Neon + CORS + seeds + demo-window posture; rollback rehearsal on Pages |

## Definition of done

Login wall up; import round-trips a real Phase-1 `synapse-db:v1` idempotently; streams restart-not-reconnect with cap notice; cross-user cache isolation regression-green; every AI-adjacent web test still passes offline on the double; server-computed scores render (client never recomputes); rollback rehearsed and documented; `just spec` + CI green; two-axis review clean; every ticket cites AD ids.

## Coordination notes

- **Single integration branch** — no parallel lanes inside; T4 ∥ T5 mid-branch at most. Owner-side provisioning (Render/Neon/R2 ENV) must be in hand before T6 (roadmap owner table).
- Epic-07 is deliberately **not** a gate; if its T1 (Solid Queue runtime) has landed, T6 boots it in-process; otherwise T6 configures without it and 07 lands later (flagged in both epics).
- The SSE ticket contract (epic-05 T4) and the error enum (epic-01 T1) are consumed **verbatim** — any drift is a cross-epic edit, surfaced not absorbed.
- `UserProgressContext` stays frozen read-only here (A1); epic-09 retires it page by page.

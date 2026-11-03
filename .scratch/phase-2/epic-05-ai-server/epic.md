# Epic 5 (Phase 2) — Server-side AI: provider adapter, mutations, SSE tickets, cost cap

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epics 01+02+03 done; **owner pre-check: GLM terms (OQ-4) before ticket 1**)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane A (critical path — 08 cannot start without this) · spine **AD-16** (server-only AI, OpenAI-compatible adapter GLM-first, SSE ticket contract, language param, 50/day + ~8k cap), **AD-5** (response contract produced server-side; features never call AI ops via raw hooks) · FR-33/34, NFR-1/2/4 · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-provider-adapter.md](issues/01-provider-adapter.md) | owner terms check | `Ai::Provider` seam, GLM OpenAI-compatible client, ENV keys, context assembly (sections/ReadingPosition) |
| 2 | [02-cost-cap.md](issues/02-cost-cap.md) | 1 | 50/user/day + ~8k context-in at the adapter boundary, CAP_REACHED, config values |
| 3 | [03-ai-mutations.md](issues/03-ai-mutations.md) | 1, 2 | generateQuiz / generateFlashcards / gradeOpenAnswer / proposal-confirm persistence |
| 4 | [04-sse-ticket-stream.md](issues/04-sse-ticket-stream.md) | 1, 2 | createStreamTicket + /api/stream: event vocabulary, single-use TTL, language param |

## Definition of done

Quiz/flashcard/grade/proposal answered by commands over the adapter with node-attributed, materials-sourced output · cap trips at the boundary with CAP_REACHED · SSE endpoint streams the contract events and 401s bad tickets · no provider key anywhere in frontend/ · rubocop+rspec green · every ticket cites AD-16/AD-5.

## Coordination notes

- **Gate: epics 01+02+03 done.** Owner-side GLM terms verification (OQ-4) gates ticket 1 — start the check when epic-03 is mid-flight (roadmap owner-window table).
- Persistence flows through epic-03's commands — shape questions go to epic-03 ticket Comments, not inventable here.
- Epic-08's SSE client + CompanionService server adapter consume ticket 4's contract verbatim — treat any contract change as a cross-epic edit.
- Runs parallel with epic-07 (both post-03); this epic owns the critical path.

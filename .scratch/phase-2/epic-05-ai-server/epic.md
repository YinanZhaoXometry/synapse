# Epic 5 (Phase 2) — Server-side AI: provider adapter, mutations, SSE tickets, cost cap

Status: in-progress (kickoff 2026-11-04; delta-grill below)

## Kickoff delta-grill (2026-11-04)

Gate verified against the board: epics 01+02+03 done — and 04/06/07 landed since the spec was authored. Spec re-checked against the landed code; **A1 and A2 both hold** (`Quiz::CreateSessionCommand` consumes a full questions array, so A2's one-mutation-response path is direct). Findings:

1. `Plans::ConfirmProposalCommand` (epic P2-3) already exists, its `stages` shape matching Phase-1's `ProposedStage` — ticket 3's proposal-confirm deliverable collapses to the **stream payload contract** (ticket 4); no new mutation.
2. rack-cors is absent entirely — "CORS = same allowlist as GraphQL" is an empty set today. Ruling: ticket 4 wires rack-cors (`CORS_ORIGIN` ENV; resources `/graphql` + `/api/stream`); epic-08 then only sets the ENV.
3. No HTTP client gem in the tree — the GLM client uses stdlib `Net::HTTP` (zero new deps; `read_body` block consumes the upstream SSE).
4. ReadingPosition text is capped at 100k chars — cannot ride a query param. Ruling (contract freeze for epic-08): grounding inputs are carried **inside the ticket payload**, set at `createStreamTicket` mint time; `GET /api/stream?ticket=…&op=…` carries only the ticket + op. Language rides the same way.
5. Phase-1 `GroundedChatRequest` has no history field (single-turn, position-grounded) — the server v1 keeps that shape; ChatThread is display persistence, fed by the client's follow-up `appendChatMessage`.
6. Quiz client-uuid replay semantics are preserved: `generateQuiz` checks replay first (existing session → returned without a provider call), then cap → generate → persist via `Quiz::CreateSessionCommand`.

OQ-4 note: proceeding GLM-first under the standing decide-all delegation — provider identity is config (`PROVIDER_BASE_URL`/`PROVIDER_MODEL`/`PROVIDER_KEY`), so a terms-driven provider change is config-only. The owner's manual live probe is `rake ai:probe`; the assumption is logged for the close-out.
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

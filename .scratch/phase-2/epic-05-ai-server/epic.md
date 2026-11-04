# Epic 5 (Phase 2) — Server-side AI: provider adapter, mutations, SSE tickets, cost cap

Status: shipped (2026-11-04 — 4 tickets done, two-axis review clean, 751/751)

## Close-out (2026-11-04)

All four tickets done and re-verified against code (Axis A spec-conformance audit proved every AC — verdict SHIP; Axis B adversarial audit — verdict FIX-FIRST, all findings landed in `fix(p2-5)`): **1×P1** (stream-ticket mint was uncapped while the migration comment claimed cap-bounded volume → `MAX_LIVE_TICKETS=10` at mint, RATE_LIMITED, comment corrected), **4×P2** (generateQuiz uuid-shape + mode guards before anything is spent; gradeOpenAnswer's `answer` bounded at 20k; `GlmClient#stream`'s dead method-level rescue moved inside the Enumerator block so pull-time timeouts surface as the typed `Ai::ProviderError` — hung-server spec added; companion grounding budgets its position header/padding). P3s: `:ticket` in filter_parameters, orphaned spec describe re-nested, `ReadingPositionInput` description says truncate, ticket 04 Bound by + AD-5, schema re-dumped.

**DoD:** quiz/flashcard/grade answered by commands over the seam with node-attributed, materials-sourced output; the proposal persistence path = the epic P2-3 `confirmProposal` (delta 1) + ticket 04's terminal payload; the cap trips at the boundary with `CAP_REACHED` (49→50→refused, restarts counted); `/api/stream` streams the frozen contract and 401s every bad ticket; **no provider key anywhere in frontend/** (grepped); rubocop+rspec green (**751 backend examples**, from 643; web: tsc/eslint/vitest 421/build all green — eslint warnings are the pre-existing shadcn react-refresh baseline); every ticket cites AD-16/AD-5 (02's Bound by is AD-16/AD-12 by nature — the cap doesn't touch the response contract; noted per Axis A finding 5).

**OQ-4 assumption (logged for the owner):** GLM-first proceeds under the standing decide-all delegation; provider identity is pure config (`PROVIDER_BASE_URL`/`PROVIDER_MODEL`/`PROVIDER_KEY`), so a terms-driven swap is config-only. `bin/rails ai:probe` is the S6-pattern manual live probe — run it after the terms check clears. Ticket 01's probe AC stays honestly unchecked until then.

**Growth:** schema +4 mutations (generateQuiz/generateFlashcards/gradeOpenAnswer/createStreamTicket) + Citation/GradedAnswer types; 2 tables (`ai_usage_counters`, `stream_tickets`, both strong_migrations two-step); 1 gem (rack-cors, the CORS_ORIGIN allowlist — blank = closed until epic-08 sets it). Epic-08 now has every gate met (02/03/04/05/06) — it consumes ticket 04's contract verbatim.

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

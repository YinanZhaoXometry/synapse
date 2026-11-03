# Spec: Epic 5 (Phase 2) — Server-side AI: provider adapter, mutations, SSE tickets, cost cap

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> AD-16/5. One hard pre-condition is owner-side: **GLM terms verification (OQ-4)** before ticket 1's
> provider integration — tracked as the roadmap's owner-window item. Gate: epics 01+02+03 done.
> Critical path: the cutover cannot start without this epic.

## Problem Statement

Phase 1 ships a simulated CompanionService behind `src/ai`; the real one must execute server-side only (FR-33 — no provider key ever reaches the client), stream tokens (Companion chat, plan-creation chat) without hacking streaming through GraphQL, and cap spend per user per day (FR-34) — with the response contract (intent, rung, citations) produced server-side so the UI renders, never guesses (AD-5/NFR-2).

## Solution

1. **Provider adapter (ticket 1):** OpenAI-compatible client behind an `Ai::Provider` seam — **GLM first**, terms verified before build (OQ-4); provider swap = config, not code. Keys only in api ENV + `.env.example` (reference pattern). Context assembly lives here too: material sections/text from Postgres, `ReadingPosition` grounding input for chat (AD-5's contract).
2. **Cost cap (ticket 2):** 50 AI calls/user/day + ~8k-token context-in bound per request, enforced at the adapter boundary; counter persisted per user-day (api-local table); `CAP_REACHED` flows through the closed enum; values in server config.
3. **AI mutations (ticket 3):** `generateQuiz(mode, scope)`, `generateFlashcards`, `gradeOpenAnswer` (+rationale), `confirmPlanProposal` persistence path — each a command wrapping the adapter, persisting through epic-03's commands; every generated question carries node attribution (AD-6); strictly materials-sourced (NFR-1).
4. **SSE surface (ticket 4):** the **only** non-GraphQL api surface: `POST/GET /api/stream` — `createStreamTicket` mutation mints an opaque single-use secret (TTL ~60s, bound to current_user + pending op); the endpoint authenticates by ticket only (401 on bad ticket, never retries auth), emits `token | citation | rung | terminal{code}` events carrying the AD-5 response contract; **reply language (zh/en) is a request parameter** following the UI toggle; CORS = same allowlist as GraphQL. No server-side resume buffering; a drop means the client restarts (deliberately cap-counted — AD-16).

## User Stories

1. As a learner, my quiz/flashcards/grades come from real AI over my materials — cited and materials-sourced only.
2. As a learner, Companion and creation-chat replies stream token by token in my UI language (zh/en).
3. As the owner, provider keys never leave the server and spend is capped at 50 calls/user/day.
4. As epic-08 (cutover), the `src/ai` seam swaps to a server adapter against a frozen contract — SSE client, ticket minting, restart semantics.
5. As an attacker, a stolen/expired/replayed ticket gets 401, always.

## Implementation Decisions

- Generation is **in-request (streamed)** — no AI jobs (AD-16; AD-19 has no AI work).
- Cap counts at adapter boundary: every provider call, including restarts after drops.
- Language parameter applies to ALL AI surfaces (mutations + streams) — one parameter, one policy.
- Ticket binding: user + op-type + one-time use; TTL ~60s; log exposure accepted (AD-16).
- Mutations persist via epic-03 commands (no second write path); SSE streams don't persist mid-stream — the terminal event's payload is persisted by the client's follow-up mutation (chat append via ticket 04's op, quiz confirm via 03's) — matching Phase-1 shapes.

## Testing Decisions

- Provider adapter tested against a stub OpenAI-compatible server (VCR-style or local stub) — no live calls in CI; one manual live probe per provider config change (S6 pattern).
- Cap: boundary tests at 49/50, restart-counting, day rollover; `CAP_REACHED` code path.
- SSE: request-spec driving the endpoint with minted tickets — event vocabulary, single-use enforcement, TTL expiry, language parameter echo, terminal error codes.
- Gates: rubocop + rspec; schema grows by the AI mutations + `createStreamTicket`.

## Out of Scope

Web SSE client + CompanionService server adapter (08) · plan-creation chat UI re-point (08) · node-*targeted* generation (10) · plan-level grounding (12) · Notes generation (12) · provider choice changes (config swap post-OQ-4).

## Further Notes

- Assumption A1: counter table is fine on the same Postgres; midnight-UTC day boundary, value in config — stated, cheap to change.
- Assumption A2: quiz/flashcard generation returns complete sessions in one mutation response (non-streamed) per AD-16 ("all AI operations are mutations **except token streams**"); if the owner later wants streamed quiz generation, that's a new stream op, not a change here.

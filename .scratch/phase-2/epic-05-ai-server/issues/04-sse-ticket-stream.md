# 04: SSE endpoint + stream-ticket contract

**What to build:** `createStreamTicket` mutation (opaque single-use secret, TTL ~60s, bound to current_user + pending op type); `GET /api/stream?ticket=…&op=…` — the **only** non-GraphQL api surface: authenticates by ticket alone (401 on bad/expired/replayed, never retries auth), emits `token | citation | rung | terminal{code}` events carrying the AD-5 response contract, accepts the **language parameter (zh/en)**, CORS under the same allowlist as GraphQL. Companion chat + plan-creation chat stream here; no resume buffering (drop = client restarts, cap-counted).

**Blocked by:** 1, 2.

**Status:** done (2026-11-04)

**Bound by:** AD-16 (ticket contract verbatim; event vocabulary; language param; one SSE surface), AD-5 (the response contract rides the stream), AD-15 (ticket bound to current_user), AD-9 (api strings are codes, never rendered verbatim).

- [x] Request-spec: full event sequence for chat + proposal streams; language echo zh/en
- [x] Single-use + TTL ~60s enforced; replay → 401; CORS allowlist = GraphQL's
- [x] Terminal events carry closed-enum codes; contract fields (intent/rung/citations) present
- [x] Contract freeze note in `## Comments` — epic-08's client consumes it verbatim

## Comments

**CONTRACT FREEZE — epic-08's web adapter consumes this verbatim (2026-11-04; any change = a cross-epic edit).**

Mint: `createStreamTicket` mutation → `{ token: String!, expiresAt: DateTime }`.
Args: `op` ("companion" | "proposal") · `language` ("zh" | "en", required) · companion: `materialId`, `question` (≤20k chars), `position` (the ReadingPositionInput `{locator, text}` — validated like saveReadingProgress, text capped at the 100k section bound), `escalated` (Boolean — the ladder amendment) · proposal: `topic` (≤500 chars, required), `goal` (≤2k chars, optional).
Refusals ride the closed enum: VALIDATION_FAILED (op/language/bounds/locator/position), NOT_FOUND (foreign/unknown material).

Stream: `GET /api/stream?ticket=…&op=…` — ticket-only auth. 401 with body `{"code":"UNAUTHORIZED"}` on missing/unknown/expired/replayed/op-mismatched tickets, never a retry. Success → SSE (`text/event-stream`, no-cache), events in THIS order:

1. `event: rung` — `{"intent":"explain","rung":"hint"|"answer","canEscalate":bool,"language":"zh"|"en"}` — request-derived server-side (escalated → "answer", else "hint"; proposal op: intent "reference", rung "hint", canEscalate false). Emitted FIRST.
2. `event: token` (many) — `{"text":"…"}` — companion: the model's prose; proposal: ONLY the text between `<outline>…</outline>` (the model's reply carries the readable outline inside those tags and the strict proposal JSON inside `<proposal>…</proposal>` — the JSON never reaches the token wire; the split is Ai::TaggedReplySplitter).
3. companion only: `event: citation` — `{"locator":{kind,sectionId|page},"quote":null}` — the grounding locator derived server-side from the ticket's position (quote is null in v1).
4. `event: terminal` (always last) — `{"code":"OK"}` on success; `{"code":<closed enum>}` on failure (CAP_REACHED trips before any token; INTERNAL for transport faults and proposal contract violations; NOT_FOUND if the ticket's material vanished). Proposal success adds `"proposal":{"topic":…,"stages":[{"name":…,"nodeTitles":[…]}],"language":…}` — the client's follow-up `confirmProposal` consumes it verbatim (the persistence path from ticket 03). No server-side resume: drop = fresh ticket + restart (cap-counted).

Infra notes: tickets live in `stream_tickets` (user-scoped, unique token, payload jsonb, expires_at, consumed_at; atomic `UPDATE … RETURNING` redeem — a 4-thread spec proves single-use); TTL = `AI_STREAM_TICKET_TTL_SECONDS` (default 60). CORS: rack-cors landed (kickoff delta 2) — origins from `CORS_ORIGIN` (comma-separated; blank = no cross-origin, the safe pre-cutover default), resources `/graphql` + `/api/stream`, no credentials (bearer-token api). Epic-08 sets `CORS_ORIGIN` at deploy.

# 04: SSE endpoint + stream-ticket contract

**What to build:** `createStreamTicket` mutation (opaque single-use secret, TTL ~60s, bound to current_user + pending op type); `GET /api/stream?ticket=…&op=…` — the **only** non-GraphQL api surface: authenticates by ticket alone (401 on bad/expired/replayed, never retries auth), emits `token | citation | rung | terminal{code}` events carrying the AD-5 response contract, accepts the **language parameter (zh/en)**, CORS under the same allowlist as GraphQL. Companion chat + plan-creation chat stream here; no resume buffering (drop = client restarts, cap-counted).

**Blocked by:** 1, 2.

**Status:** ready-for-agent

**Bound by:** AD-16 (ticket contract verbatim; event vocabulary; language param; one SSE surface), AD-15 (ticket bound to current_user), AD-9 (api strings are codes, never rendered verbatim).

- [ ] Request-spec: full event sequence for chat + proposal streams; language echo zh/en
- [ ] Single-use + TTL ~60s enforced; replay → 401; CORS allowlist = GraphQL's
- [ ] Terminal events carry closed-enum codes; contract fields (intent/rung/citations) present
- [ ] Contract freeze note in `## Comments` — epic-08's client consumes it verbatim

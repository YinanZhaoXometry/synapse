# 04: SSE client wrapper — fresh-ticket restart, cap notice, terminal-code mapping

**What to build:** the stream client under `src/ai`'s server adapter: `createStreamTicket` mint → EventSource with **auto-reconnect disabled**; on drop → mint fresh ticket → **restart** the generation → surface the cap-counted notice (never silent); terminal events map `code → AppError → t()` key; language parameter follows the UI toggle (zh/en, per EXPERIENCE); contract fields (intent/rung/citations) parsed into the AD-5 response shape the UI already renders.

**Blocked by:** 1.

**Status:** done (2026-11-04, `1edbab5` — 19 offline tests; review pending the epic's pre-merge pass). ACs verified by the epic's code-review pass 2026-11-04.

**Bound by:** AD-16 (client restart semantics verbatim), AD-5 (UI renders the contract, never guesses), AD-9 (codes → keys, never server strings).

- [x] Drop → restart → cap notice visible in both languages; no reconnect attempts
- [x] Terminal error codes map through AppError to i18n keys (full closed enum)
- [x] Language toggle mid-session applies to the next stream (asserted)
- [x] Contract parse covered by deterministic tests (fixture streams, no server)

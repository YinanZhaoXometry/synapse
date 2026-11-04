# 02: Per-user daily cost cap at the adapter boundary

**What to build:** counter (user-day rows, A1) incremented on **every** provider call including stream restarts; enforcement before the call: >50/day → `CAP_REACHED` Failure; per-request context-in bound ~8k tokens (truncate assembly deterministically, never silently mis-ground); values in server config + `.env.example`.

**Blocked by:** 1.

**Status:** done (2026-11-04)

**Bound by:** AD-16 (cap at the AI adapter boundary; 50/day + ~8k set per NFR-4), AD-12 (CAP_REACHED from the closed enum), FR-34.

- [x] Boundary specs: 49→50→CAP_REACHED; day rollover; restart double-count (deliberate)
- [x] Context truncation deterministic + tested at the bound
- [x] Config values overridable via ENV; documented

## Comments

- The counter is the api-local `ai_usage_counters` table (A1: same Postgres, not a spine entity) — one row per user per UTC day, written ONLY by `Ai::DailyCap.consume!`, a single atomic `INSERT … ON CONFLICT … RETURNING` (check and increment in one statement; a 4-thread concurrency spec proves increments never drop). FK landed via the strong_migrations two-step (validate: false → validate).
- Enforcement sits inside `Ai::Provider.dispatch` (the adapter boundary): configured-check → cap consume → adapter call. Consequences pinned by specs: an unconfigured provider consumes nothing; the 50th call is admitted and the 51st refused with `CAP_REACHED` **without touching the transport**; every `.stream` invocation consumes one call (restart-after-drop = counted, AD-16); day rollover gives a fresh count.
- Context-in bound: `AI_CONTEXT_BUDGET_TOKENS` (default 8000) is enforced by `Ai::ContextAssembler`'s deterministic whole-section fill + marked hard cut — ticket 01 landed the module, ticket 02's specs pin the never-exceeds-budget invariant (`spec/ai/context_assembler_spec.rb`).
- Config: `AI_DAILY_CALL_CAP` (default 50) + `AI_CONTEXT_BUDGET_TOKENS` (default 8000), ENV-at-call-time, garbage → default — documented in `backend/.env.example`.
- Also in this ticket's commit (config posture, noted for review): `PROVIDER_KEY` joined production's boot fail-fast list (the R2_* pattern) — server-side AI is a production surface from the P2-8 cutover; cap values deliberately stay optional-with-default (login rate-limit posture).

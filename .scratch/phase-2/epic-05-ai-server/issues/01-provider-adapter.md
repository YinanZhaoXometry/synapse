# 01: Provider adapter seam — OpenAI-compatible, GLM first

**What to build:** `app/ai/provider.rb` seam + GLM client (OpenAI-compatible endpoint, base URL + model + key from ENV: `PROVIDER_KEY` etc. in `.env.example`); a provider swap is config, not code. Context assembly helpers: material sections/text from Postgres, `ReadingPosition` grounding input (locator + text), plan-scope assembly (all attached materials' text, bounded). Response-contract mapping (intent, rung, citations) server-side per AD-5.

**Blocked by:** None in-epic; **owner gate: GLM terms verified (OQ-4)** — do not integrate before it clears.

**Status:** done (2026-11-04 — code + specs landed; the live probe below stays owner-gated on OQ-4)

**Bound by:** AD-16 (keys server-only; OpenAI-compatible adapter; OQ-4), AD-5 (contract produced server-side), NFR-2 (guardrail posture rides the contract).

- [x] Provider seam + GLM config; stub-able in tests (no live calls in CI)
- [ ] One manual live probe recorded (S6 pattern) once terms clear — `bin/rails ai:probe` is the probe; owner runs it after OQ-4 clears
- [x] Context assembly: ReadingPosition-grounded + plan-scope variants, bounded to the context-in budget input
- [x] `.env.example` documents all provider vars

## Comments

- **Path deviation (recorded at implementation):** the ticket said `app/ai/provider.rb`, but Rails `app/*` directory names are invisible to Zeitwerk (`app/models/user.rb` → `User`), so `app/ai/provider.rb` would have had to define a top-level `Provider`. The module lives at `app/lib/ai/` with the `Ai` namespace root in `app/lib/ai.rb` — the exact shape of the Accounts precedent (`app/lib/accounts.rb` + `app/lib/accounts/*`). Constants are unchanged: `Ai::Provider`, `Ai::GlmClient`, `Ai::ContextAssembler`, `Ai::ProviderError`.
- **Transport = stdlib Net::HTTP** (kickoff delta 3): zero new deps; streaming is `read_body`-block consumption of the upstream SSE. Tested against a local stdlib `TCPServer` stub (no WebMock in the tree) — request shape, chunk fragmentation, `[DONE]`, mid-stream error payloads, non-200 statuses.
- The seam's `dispatch` maps every `Ai::ProviderError` to `Failure(:INTERNAL)`; unconfigured (blank `PROVIDER_KEY`) is also `INTERNAL` — the pre-cutover dev/test state, since the web still runs the simulated adapter until epic P2-8.
- Context bounding invariant (pinned by specs): the assembled text's token estimate never exceeds the budget — block headers and trailing newlines are budgeted with 1 token reserved for padding. Estimation is a fixed 3 chars/token (zh-heavy conservative), documented in the module header.
- Truncation is deterministic: whole sections in stable order (nodes by `order`, materials by attach time), hard cut with ` …[truncated]` marker when nothing fits whole, and an `Assembled.truncated` flag — never a silent cut (ticket 02's contract, tested here at the module where it lives).

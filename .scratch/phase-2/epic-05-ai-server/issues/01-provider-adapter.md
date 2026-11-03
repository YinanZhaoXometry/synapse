# 01: Provider adapter seam — OpenAI-compatible, GLM first

**What to build:** `app/ai/provider.rb` seam + GLM client (OpenAI-compatible endpoint, base URL + model + key from ENV: `PROVIDER_KEY` etc. in `.env.example`); a provider swap is config, not code. Context assembly helpers: material sections/text from Postgres, `ReadingPosition` grounding input (locator + text), plan-scope assembly (all attached materials' text, bounded). Response-contract mapping (intent, rung, citations) server-side per AD-5.

**Blocked by:** None in-epic; **owner gate: GLM terms verified (OQ-4)** — do not integrate before it clears.

**Status:** ready-for-agent (owner pre-check tracked on the roadmap)

**Bound by:** AD-16 (keys server-only; OpenAI-compatible adapter; OQ-4), AD-5 (contract produced server-side), NFR-2 (guardrail posture rides the contract).

- [ ] Provider seam + GLM config; stub-able in tests (no live calls in CI)
- [ ] One manual live probe recorded (S6 pattern) once terms clear
- [ ] Context assembly: ReadingPosition-grounded + plan-scope variants, bounded to the context-in budget input
- [ ] `.env.example` documents all provider vars

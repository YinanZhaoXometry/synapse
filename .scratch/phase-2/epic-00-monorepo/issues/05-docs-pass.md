# 05: Docs pass — root AGENTS.md rewritten, `api/AGENTS.md` authored, deploy doc re-pointed, README un-stubbed

**What to build:** the repo's self-description matches the monorepo and reality. Root AGENTS.md gives agents true commands (pnpm layout + nvm-shim gotchas) and true storage-key names (closing epic-7's closure observation); `api/AGENTS.md` exists as the api's architecture contract with every rule citing its AD id; the deploy doc shows the post-restructure Cloudflare Pages values with an explicit one-line owner note; README describes Synapse, not Lovable.

**Blocked by:** 01 (final web paths to describe), 02 (api reality to describe).

**Status:** done 2026-11-03 — a57b580/173d842 + review fixes f7d610f..96eb1ea, merged into epic/p2-0-monorepo (main merge post-Nov-6)

**Bound by:** AD-17 (AGENTS.md ×2 in the same change), AD-12/13/16/19 (the rules `api/AGENTS.md` encodes), AD-20 (deployment envelope values), AD-11 (Pages SPA fallback — unchanged).

- [x] Root AGENTS.md: monorepo structure map; commands true from the `web/` layout via the pnpm toolchain (never bare npm/npmx — A4); gotchas kept/updated: build ≠ typecheck, dev port 8080, tsbuildinfo staleness, nvm lazy-load shim hijack, **corrected storage-key names** (`studyflow-lang` on disk; theme keys lazy-written) — epic-7's observation closed
- [x] `api/AGENTS.md`: the api's architecture contract — command-layer-first (AD-12), closed error enum ↔ `AppError.code` 1:1 via `extensions.code`, client-suppliable UUIDs, AI executes server-side + SSE ticket contract (AD-16), Solid-Queue posture + deferral (AD-19 — A9), naming conventions — each rule cites its AD id
- [x] Deploy doc re-pointed: Pages root directory `web`, build command + output dir per the new layout, plus an explicit note that the owner edits the Pages project's root directory once after this epic merges (Q3=b)
- [x] README rewritten: Synapse product intro, structure map, `just` quickstart; zero Lovable remnants
- [x] GLOSSARY.md untouched (domain vocabulary unchanged — verified in the grill/domain pass)

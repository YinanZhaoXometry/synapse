# AGENTS.md

## What this is

**Synapse** — a bilingual (中文/English) AI-powered study web app, built as the COMP5241 (Software Engineering, PolyU) course project. The brand stays "Synapse" in Chinese contexts too — no translated Chinese name. Frontend stack: Vite 5 + React 18 + TypeScript + shadcn/ui + Tailwind 3; backend stack: Rails 8.1 API-only (GraphQL). The repo is a **monorepo** (`frontend/` + `backend/` + root `justfile`, AD-17) — the only cross-stack contract is the backend-committed `backend/schema.graphql`. (Folders were named `web/`+`api/` until 2026-11-04 — owner renamed them; older prose saying "web"/"api" means these.)

Fresh restart repo (started from zero, Nov 2026). The previous BMad-era implementation is archived at `../project-new-archive-20261101` — do not confuse its structure/epics with this codebase.

**Core product concept (approved brief + final PRD, 2026-11-01 — [brief](docs/product/brief-synapse/brief-synapse.md) · [PRD](docs/product/prd-synapse/prd-synapse.md)):** AI-guided study platform, AI-only (no manual mode — owner removed the old ai/non-ai comparison concept). **Study Plan is the front door** (system gives the plan, never content; users attach their own materials; roadmap.sh roadmaps import as ready-made plans). Study Task = plan-free single-document study. Mastery Score 0–100% per node/plan; 100% = exam/interview readiness; evidence-only (marking = claim + confirm quiz). Sidebar = 4 aggregated hubs (Mistakes, Today/今日学习 — daily task list, not a calendar, Flashcards, Quiz); generation happens in-flow (PRD FR-36). Quiz = Open + Choice (+Mix), strictly materials-sourced. Phase 1 (Nov 6): entry states, Study Task, reader + page-aware Companion, quiz, working Mastery Score, persistence, deployment. **Retained destinations (owner round 2026-11-01):** the scaffold's ten-page nav — Dashboard/仪表盘, AI Tutor/AI 导师, Materials, Quiz, Flashcards, Mistakes, Planner, Achievements/成就, Analytics/数据分析 + the sidebar's user-profile footer and Settings gear — stays alongside the plan-first build (PRD FR-25/26/28/36/46; UX spine IA table). Dual-mode legacy (`LearningModeContext`, `aiOnly` gating, mode toggle, onboarding mode step) is removed in the first implementation pass (2026-11-01).

## Repo layout (AD-17)

```
frontend/  the Vite SPA — everything frontend
backend/   the Rails 8.1 API-only service — see backend/AGENTS.md (its architecture contract)
justfile  root orchestrator: just setup · dev · up · spec
docs/     product/design/architecture/agents docs (stays at root)
.scratch/ local issue tracker (stays at root)
.github/  CI workflow(s) — web gates + api gates on push/PR to main
```

## Commands

**The frontend toolchain is npm** (2026-11-07 owner decision, reverting the pnpm-only amendment — the only lockfile is `frontend/package-lock.json`; `npm ci` is the frozen install; matches the spine's AD-17 "incumbent toolchain" note). **In agent/non-interactive shells never invoke `npm`/`npx`/`node` by name** — see the nvm-shim gotcha below (interactive shells are fine).

```bash
# Repo-level entrypoints (root justfile):
just setup   # web install + minio image bootstrap (fresh machines — see Dockerfile.minio) + api image build/pull
just dev     # web Vite dev server (proxies /graphql to :3000 — bring the stack up first)
just up      # compose: postgres 17 + minio + api (api on port 3000)
just migrate # db:migrate in the running api container — run after pulling migrations the stack booted before
just spec    # web gates + api gates

# Frontend gates (from frontend/ — two true invocation forms):
# (sequence kept in sync with the justfile spec recipe + ci.yml web job)
npm run codegen                             # GraphQL documents (freshness-gated — see below)
cd frontend && node_modules/.bin/tsc -b     # typecheck (no `typecheck` script exists)
cd frontend && node_modules/.bin/eslint .   # eslint 9 flat config
cd frontend && node_modules/.bin/vitest run --coverage  # tests + coverage (epic P3-17; watch: npm run test:watch; plain `vitest run` stays fine for iteration)
cd frontend && node_modules/.bin/vite build # build only — does NOT typecheck
# Mastery-vector anti-drift (after build; part of just spec + ci.yml's web job,
# not a standalone command): regenerate backend/spec/fixtures/mastery_vectors.json
# from the TS domain and require a STAMP-INSENSITIVE match — the diff strips
# meta.generatedAtSourceCommit (advisory, self-referential provenance) from both
# sides first. See the justfile spec recipe / ci.yml for the exact step.
# Coverage: both stacks measure it (SimpleCov backend / @vitest/coverage-v8
# frontend, epic P3-17 T01/T02); backend's `minimum_coverage line: 95` floor
# lives in backend/spec/spec_helper.rb — a red floor is a red rspec run.
# …or through npm directly: cd frontend && npm run <script>

# Api gates (dev containers only — your local Ruby is irrelevant):
# the api's compose command forms, gate notes, and architecture contract all
# live in backend/AGENTS.md — `just spec` (above) is the local entrypoint for them.
```


Tests (frontend): Vitest, jsdom env, globals on, setup in `frontend/src/test/setup.ts` (jest-dom + `matchMedia` mock + `ResizeObserver`/`IntersectionObserver` stubs — jsdom 20 ships neither); place tests as `frontend/src/**/*.{test,spec}.{ts,tsx}`. Interaction tests are **userEvent-first** (epic-17 convention, 2026-11-06): new tests use `@testing-library/user-event`, not `fireEvent` — the 400+ legacy `fireEvent` calls stay as-is, migrate opportunistically when a test is already being touched. The i18n dictionary's zh/en parity is enforced over the FULL table by `src/contexts/i18n-full-parity.test.ts` — a one-sided key fails CI.

Playwright e2e lives in `frontend/e2e/` (`just e2e` — one command: flips the backend to the stub provider, runs the suite, restores the demo stack; 2026-11-06): the critical-flow suite (auth wall, demo plan, creation chat, material→reader→claim honesty, quiz→mastery loop, mistakes hub, square fork, task promotion, settings, hubs) runs against the live local stack with a deterministic **stub AI provider** (`frontend/e2e/stub-provider.mjs`, auto-started by the config) — no provider key, no live AI. AI-gated surfaces (companion, quick test, open/mix quiz, notes, flashcard generation) are deliberately uncovered. Upload prerequisites: `127.0.0.1 minio` /etc/hosts entry + bucket CORS (the demo boot has both). Tests self-isolate via fresh registered users; the dev DB accumulates e2e rows. The old `lovable-agent-playwright-config` import (never installed) was removed with this harness.

## Architecture

**`frontend/`** — the SPA:

- `src/App.tsx` — all routes. `/` = `EntryGate` (first run → onboarding wizard; returning users → Plans Home, AD-8). Plan/task study flows nest under `AppLayout` (sidebar shell): `/plans`, `/plan/:id` (+ `/quiz`, `/flashcards`), `/task/new`, `/task/:id` (+ `/quiz`, `/flashcards`), `/read/:materialId`, plus the retained ten destinations (`/dashboard`, `/ai-tutor`, `/materials`, `/quiz`, `/flashcards`, `/mistakes`, `/planner`, `/achievements`, `/analytics`, `/settings`).
- `src/contexts/` — `LanguageProvider` → `ThemeProvider`, nested inside `ApolloProvider` + `TooltipProvider` in App.tsx. Consume via `useLanguage()` / `useTheme()` (hooks throw outside their provider). The translations table (`i18n-dictionary.ts`) lives beside them. (`UserProgressContext` was deleted in epic P2-09 T6 — the demo progress context's retirement completed there; domain data comes from the typed hooks layer, and the architecture grep-guard keeps the name dead.)
- `src/apollo/` — the Apollo Client 4 seam (AD-18, epic P2-8): the client singleton (auth link + relative `/graphql` uri, dev-proxied to :3000), the `synapse-token` auth seam, and `resetApiClient()` (cache wipe + SSE terminators) — the ONE seam login/logout/account switches funnel through.
- `src/api/` — the typed hooks layer: the ONLY route features touch domain data. `src/lib/graphql/*.graphql` operations → `npm run codegen` → committed `src/types/graphql.ts` (TypedDocumentNodes; CI regenerates + diffs — never edit the output). Hooks return mapped domain views; plans/nodes carry SERVER mastery fields (`masteryScore`, `state`) — rendering reads them, never recomputes (AD-14). Conventions live in `src/api/index.ts`'s header.
- `src/domain/` — pure domain logic: `mastery.ts` (ADR-0001 rules), `streak.ts`, `entities.ts`. Vitest coverage is mandatory here (AD-10).
- `src/features/` — feature modules: `companion`, `flashcards`, `plans`, `quiz`, `reader`, `tasks`.
- `src/ai/` — the simulated `CompanionService` (Phase-1 AI seam, AD-5) — since the cutover (epic P2-8) it runs as the dev/test double (deterministic offline tests); the server adapter rides ticket 05's seam swap.
- `src/components/ui/` — shadcn/ui primitives (Radix + CVA). Treat as generated code; app-specific reusable components go in `src/components/shared/`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge); use it for all conditional classes.

**`backend/`** — the Rails 8.1 GraphQL service (minimal bootable scaffold: one `health` query, committed `schema.graphql`, RSpec + RuboCop green). Its architecture contract — command-layer-first, error enum, naming, what lands with which epic — is [`backend/AGENTS.md`](backend/AGENTS.md). Read it before any backend work.

## Conventions

- **Path alias:** `@/*` → `src/*` (relative — it survived both monorepo moves unchanged). It is declared in four places that must stay in sync: `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`.
- **i18n is mandatory:** never hardcode user-facing strings. Add a dotted key with `{ zh, en }` to the `translations` table in `frontend/src/contexts/i18n-dictionary.ts` and render via `t("dotted.key")` from `useLanguage()`; `{var}` interpolation is supported.
- **TypeScript is deliberately loose:** `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, unused-vars/params checks off (also `@typescript-eslint/no-unused-vars` off in eslint). Don't tighten these or bulk-annotate types in unrelated edits.
- **Tailwind:** theme colors are CSS-variable/HSL tokens defined in `frontend/src/index.css` and mapped in `frontend/tailwind.config.ts` — use semantic classes (`bg-background`, `text-muted-foreground`, `bg-primary`), not raw palette classes. Never hardcode whites (`bg-white/…`) or coral `rgba()` values — they break dark mode and the theme palettes; use the glass (`--glass-*`) and accent-tint (`--accent-tint*` / `--accent-ring` / `--accent-edge`) tokens instead. The app ships dark mode + sunset/twilight/aurora palettes (`ThemeProvider`) — verify UI in both modes. Custom fonts: `font-display` (Source Serif 4) / `font-body` (Inter). Custom animations exist (`animate-pop`, `animate-slide-up`, `animate-confetti`, …).
- **Toasts:** sonner is the single toast pattern (App.tsx mounts the sonner-backed `<Toaster />`; AD-9). `AppError.messageKey` → `t()` key → toast.

## localStorage keys (truth from code, 2026-11-04, post-Apollo-cutover)

- **`synapse-token`** (`src/apollo/auth-token.ts`) — the JWT; read by the Apollo auth link, written by login/logout (ticket 02). Server TTL is 24h; a stale token surfaces as UNAUTHENTICATED, never silently.
- **`synapse-db:v1`** — the Phase-1 legacy document. NOT in the runtime anymore (the grep guard forbids reading/writing it outside `src/lib/local-document.ts`); it survives as the rollback substrate and ticket 03's first-login-import input — never deleted client-side.
- **`synapse-import:done`** (`src/lib/import-offer.ts`) — the first-login import's one-time-offer marker (`"1"`): written on import success AND on "not now", so the offer never nags again. It is its own key — never the legacy document (that stays untouched above) and never a UI pref.
- **`synapse-lang`** (`LanguageContext.tsx`), **`synapse-theme`** / **`synapse-mode`** / **`synapse-motion`** (`ThemeContext.tsx`) — UI prefs; theme palette id (`sunset` default), mode (`system` default), motion (`"on"`/`"off"` string; reduce-motion reads it as `=== "off"`).
- All four UI keys are **lazy-written**: nothing is persisted on first load — the write happens inside the setter (`setLanguage`/`setTheme`/`setMode`/`setReduceMotion`), so a key exists in storage only after the user changes that setting once. Reads at provider init always fall back (lang `zh`, theme `sunset`, mode `system`, motion on).
- There is **no `studyflow-lang`** anywhere in the code — the 2026-11-01 product rename moved the key to `synapse-lang` (commit `c07e669`) with no migration reading the old name. A `studyflow-lang` entry seen in a browser profile is orphaned pre-rename residue; nothing reads it.

## Gotchas

- **nvm lazy-load shim hijacks `npm`/`npx`/`node`**: in non-interactive/agent shells they are shell functions whose `_nvm_lazy_load` helper isn't loaded — bare invocation crashes with exit 127 (`command not found: _nvm_lazy_load`), and the function wins over even a PATH-prepended real binary. Use absolute paths (`~/.nvm/versions/node/v24.22*/bin/npm` / `npx`), or `frontend/node_modules/.bin/<tool>` (its `env node` shebang resolves fine). Don't "fix" this in shell config — invoke the tools honestly.
- **npm is the frontend package manager (2026-11-07)**: the lockfile is `frontend/package-lock.json`; install with `npm ci` (frozen) from `frontend/`. A leftover pnpm-style `node_modules` (symlinked store) must be wiped (`rm -rf node_modules`) first — npm cannot read it (arborist crashes). Never prune or restructure `node_modules` by hand.
- **`vite build` passing ≠ types are fine.** The `build` script is `vite build` only; run `tsc -b` separately when type safety matters.
- **HMR error overlay is disabled** (`frontend/vite.config.ts`), so dev errors only appear in the terminal — watch it, not just the browser.
- **Web dev server binds host `::` on port 8080** (not Vite's default 5173). The api serves on port 3000 (compose).
- **`frontend/tsconfig.app.tsbuildinfo` / `frontend/tsconfig.node.tsbuildinfo` are committed** (policy unchanged — A6). Their contents are relative paths, so they survive the move; a stale one self-heals on the next `tsc -b` (regen verified byte-identical) — commit the regenerated file if a legit path change lands.
- **CI** runs the same gates on GitHub Actions (push/PR to `main` and `epic/**`): web = `npm ci` → codegen (regenerate + diff — schema drift fails loudly) → `tsc -b` → eslint → vitest --coverage → `vite build` → mastery-vector anti-drift (regenerate + stamp-insensitive diff — same step `just spec` runs); api = rubocop → rspec (SimpleCov line floor lives in spec_helper); **e2e** (epic-17 T05) = compose demo stack + `compose.e2e.yaml` stub wiring → Playwright critical flows (retries 2 in CI, report/traces uploaded on failure). Keep local green before pushing.
- `backend/README.md` is still the Rails generator stub — the backend's real doc is `backend/AGENTS.md`.
- ~~`lovable-tagger`~~ — the Lovable-scaffold residue was REMOVED 2026-11-06 (debt batch: devDependency + the dev-mode `componentTagger` Vite plugin + lockfile regen); `vite.config.ts` now carries only `react()`.

## Agent skills

### Issue tracker

Issues live as local markdown under `.scratch/` (solo-dev repo — GitHub Issues closed 2026-11-02, kept as archive; spec/ticket history: `.scratch/phase-1/epic-01-foundation/`). Epic trackers live two-level: `.scratch/phase-<N>/epic-<NN>-<slug>/` (e.g. `phase-2/epic-00-monorepo/`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as `Status:` lines in ticket files; `done` marks completed work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`, read per the consumer rules in `docs/agents/domain.md`.

### Planning workflow

BMAD owns product thinking: `/bmad-product-brief` → `docs/product/`, `/bmad-ux` → `docs/design/`, `/bmad-architecture` → `docs/architecture/` (spine with stable decision IDs). Matt Pocock skills own implementation: `/grill-with-docs` → `/to-spec` → `/to-tickets`, then `/tdd` / `/implement` / `/code-review`. One spec pipeline per feature; tickets reference spine decision IDs. See `docs/agents/workflow.md`.

### Implementation worktrees (owner ruling, 2026-11-06)

Epic/ticket **implementation always runs in a dedicated git worktree** (`project-new-<name>` beside the repo) — never on the main checkout, which stays free for the owner's manual testing and doc/board commits. Branch naming: `epic/p<N>-<nn>-<slug>` (epic) or `p<N>-<nn>/t<NN>-<slug>` (ticket). **Merging to `main` is the delete trigger**: once merged (verified), remove the worktree and delete the branch, local + remote; keep one alive only for an explicit owner-stated reason. New worktrees bootstrap from zero (`npm ci` in frontend/; backend test DB via `db:drop db:create db:migrate`; parallel worktrees override ports + compose `-p`). Full rule: `docs/agents/workflow.md` § Implementation worktree discipline.

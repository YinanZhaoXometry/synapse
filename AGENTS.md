# AGENTS.md

## What this is

**Synapse** — a bilingual (中文/English) AI-powered study web app, built as the COMP5241 (Software Engineering, PolyU) course project. The brand stays "Synapse" in Chinese contexts too — no translated Chinese name. Web stack: Vite 5 + React 18 + TypeScript + shadcn/ui + Tailwind 3; api stack: Rails 8.1 API-only (GraphQL). The repo is a **monorepo** (`web/` + `api/` + root `justfile`, AD-17) — the only cross-stack contract is the api-committed `api/schema.graphql`.

Fresh restart repo (started from zero, Nov 2026). The previous BMad-era implementation is archived at `../project-new-archive-20261101` — do not confuse its structure/epics with this codebase.

**Core product concept (approved brief + final PRD, 2026-11-01 — [brief](docs/product/brief-synapse/brief-synapse.md) · [PRD](docs/product/prd-synapse/prd-synapse.md)):** AI-guided study platform, AI-only (no manual mode — owner removed the old ai/non-ai comparison concept). **Study Plan is the front door** (system gives the plan, never content; users attach their own materials; roadmap.sh roadmaps import as ready-made plans). Study Task = plan-free single-document study. Mastery Score 0–100% per node/plan; 100% = exam/interview readiness; evidence-only (marking = claim + confirm quiz). Sidebar = 4 aggregated hubs (Mistakes, Today/今日学习 — daily task list, not a calendar, Flashcards, Quiz); generation happens in-flow (PRD FR-36). Quiz = Open + Choice (+Mix), strictly materials-sourced. Phase 1 (Nov 6): entry states, Study Task, reader + page-aware Companion, quiz, working Mastery Score, persistence, deployment. **Retained destinations (owner round 2026-11-01):** the scaffold's ten-page nav — Dashboard/仪表盘, AI Tutor/AI 导师, Materials, Quiz, Flashcards, Mistakes, Planner, Achievements/成就, Analytics/数据分析 + the sidebar's user-profile footer and Settings gear — stays alongside the plan-first build (PRD FR-25/26/28/36/46; UX spine IA table). Dual-mode legacy (`LearningModeContext`, `aiOnly` gating, mode toggle, onboarding mode step) is removed in the first implementation pass (2026-11-01).

## Repo layout (AD-17)

```
web/      the Vite SPA — everything frontend
api/      the Rails 8.1 API-only service — see api/AGENTS.md (its architecture contract)
justfile  root orchestrator: just setup · dev · up · spec
docs/     product/design/architecture/agents docs (stays at root)
.scratch/ local issue tracker (stays at root)
.github/  CI workflow(s) — web gates + api gates on push/PR to main
```

## Commands

**The web toolchain is pnpm-only** (the only lockfile is `web/pnpm-lock.yaml`; `packageManager` pins pnpm 10.9.0). **Never run bare `npm`/`npx`/`node`** — see the nvm-shim gotcha below.

```bash
# Repo-level entrypoints (root justfile):
just setup   # web install + api image build/pull
just dev     # web Vite dev server (api has no web-facing behavior until the Apollo cutover)
just up      # compose: postgres 17 + api (api on port 3000)
just spec    # web gates + api gates

# Web gates (from web/ — two true invocation forms):
# (sequence kept in sync with the justfile spec recipe + ci.yml web job)
cd web && node_modules/.bin/tsc -b          # typecheck (no `typecheck` script exists)
cd web && node_modules/.bin/eslint .        # eslint 9 flat config
cd web && node_modules/.bin/vitest run      # tests (watch: pnpm run test:watch)
cd web && node_modules/.bin/vite build      # build only — does NOT typecheck
# …or through pnpm directly: ~/Library/pnpm/pnpm --dir web run <script>

# Api gates (dev containers only — your local Ruby is irrelevant):
# the api's compose command forms, gate notes, and architecture contract all
# live in api/AGENTS.md — `just spec` (above) is the local entrypoint for them.
```


Tests (web): Vitest, jsdom env, globals on, setup in `web/src/test/setup.ts` (jest-dom + a `matchMedia` mock); place tests as `web/src/**/*.{test,spec}.{ts,tsx}`.

Playwright (`web/playwright.config.ts`) imports `lovable-agent-playwright-config`, which is **not in package.json** — e2e won't run locally until that dep is added; no e2e specs exist yet (known debt, moves with the epic that owns e2e).

## Architecture

**`web/`** — the SPA:

- `src/App.tsx` — all routes. `/` = `EntryGate` (first run → onboarding wizard; returning users → Plans Home, AD-8). Plan/task study flows nest under `AppLayout` (sidebar shell): `/plans`, `/plan/:id` (+ `/quiz`, `/flashcards`), `/task/new`, `/task/:id` (+ `/quiz`, `/flashcards`), `/read/:materialId`, plus the retained ten destinations (`/dashboard`, `/ai-tutor`, `/materials`, `/quiz`, `/flashcards`, `/mistakes`, `/planner`, `/achievements`, `/analytics`, `/settings`).
- `src/contexts/` — `LanguageProvider` → `ThemeProvider` → `UserProgressProvider`, nested inside `QueryClientProvider` + `TooltipProvider` in App.tsx. Consume via `useLanguage()` / `useTheme()` / `useUserProgress()` (hooks throw outside their provider). The translations table (`i18n-dictionary.ts`) lives beside them.
- `src/data/` — the persistence layer: repositories + TanStack Query hooks (`*-queries.ts`, `query-keys.ts`), the versioned `synapse-db:v1` document (`document.ts` + `store.ts`), and `errors.ts` (`AppError { code, messageKey? }`).
- `src/domain/` — pure domain logic: `mastery.ts` (ADR-0001 rules), `streak.ts`, `entities.ts`. Vitest coverage is mandatory here (AD-10).
- `src/features/` — feature modules: `companion`, `flashcards`, `plans`, `quiz`, `reader`, `tasks`.
- `src/ai/` — the simulated `CompanionService` (Phase-1 AI seam, AD-5) — becomes a dev/test double at the Apollo cutover (AD-18).
- `src/components/ui/` — shadcn/ui primitives (Radix + CVA). Treat as generated code; app-specific reusable components go in `src/components/shared/`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge); use it for all conditional classes.

**`api/`** — the Rails 8.1 GraphQL service (minimal bootable scaffold: one `health` query, committed `schema.graphql`, RSpec + RuboCop green). Its architecture contract — command-layer-first, error enum, naming, what lands with which epic — is [`api/AGENTS.md`](api/AGENTS.md). Read it before any api work.

## Conventions

- **Path alias:** `@/*` → `src/*` (relative — it survived the `web/` move unchanged). It is declared in four places that must stay in sync: `web/vite.config.ts`, `web/vitest.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`.
- **i18n is mandatory:** never hardcode user-facing strings. Add a dotted key with `{ zh, en }` to the `translations` table in `web/src/contexts/i18n-dictionary.ts` and render via `t("dotted.key")` from `useLanguage()`; `{var}` interpolation is supported.
- **TypeScript is deliberately loose:** `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, unused-vars/params checks off (also `@typescript-eslint/no-unused-vars` off in eslint). Don't tighten these or bulk-annotate types in unrelated edits.
- **Tailwind:** theme colors are CSS-variable/HSL tokens defined in `web/src/index.css` and mapped in `web/tailwind.config.ts` — use semantic classes (`bg-background`, `text-muted-foreground`, `bg-primary`), not raw palette classes. Never hardcode whites (`bg-white/…`) or coral `rgba()` values — they break dark mode and the theme palettes; use the glass (`--glass-*`) and accent-tint (`--accent-tint*` / `--accent-ring` / `--accent-edge`) tokens instead. The app ships dark mode + sunset/twilight/aurora palettes (`ThemeProvider`) — verify UI in both modes. Custom fonts: `font-display` (Source Serif 4) / `font-body` (Inter). Custom animations exist (`animate-pop`, `animate-slide-up`, `animate-confetti`, …).
- **Toasts:** sonner is the single toast pattern (App.tsx mounts the sonner-backed `<Toaster />`; AD-9). `AppError.messageKey` → `t()` key → toast.

## localStorage keys (truth from code, 2026-11-03)

- **`synapse-db:v1`** — the domain document (`web/src/data/document.ts`); the repositories' single store, versioned + migrated on load.
- **`synapse-lang`** (`LanguageContext.tsx`), **`synapse-theme`** / **`synapse-mode`** / **`synapse-motion`** (`ThemeContext.tsx`) — UI prefs; theme palette id (`sunset` default), mode (`system` default), motion (`"on"`/`"off"` string; reduce-motion reads it as `=== "off"`).
- All four UI keys are **lazy-written**: nothing is persisted on first load — the write happens inside the setter (`setLanguage`/`setTheme`/`setMode`/`setReduceMotion`), so a key exists in storage only after the user changes that setting once. Reads at provider init always fall back (lang `zh`, theme `sunset`, mode `system`, motion on).
- There is **no `studyflow-lang`** anywhere in the code — the 2026-11-01 product rename moved the key to `synapse-lang` (commit `c07e669`) with no migration reading the old name. A `studyflow-lang` entry seen in a browser profile is orphaned pre-rename residue; nothing reads it.

## Gotchas

- **nvm lazy-load shim hijacks `npm`/`npx`/`node`**: in non-interactive/agent shells they are shell functions whose `_nvm_lazy_load` helper isn't loaded — bare invocation crashes with exit 127 (`command not found: _nvm_lazy_load`). Use `~/Library/pnpm/pnpm`, `pnpm` (the standalone binary on PATH), or `web/node_modules/.bin/<tool>` (its `env node` shebang resolves fine). Don't "fix" this in shell config — invoke the tools honestly.
- **pnpm node_modules layout**: `web/node_modules` is pnpm's symlinked store — npm/yarn commands misread it. Install only with pnpm (`pnpm install --frozen-lockfile` in `web/`); never prune or restructure by hand.
- **`vite build` passing ≠ types are fine.** The `build` script is `vite build` only; run `tsc -b` separately when type safety matters.
- **HMR error overlay is disabled** (`web/vite.config.ts`), so dev errors only appear in the terminal — watch it, not just the browser.
- **Web dev server binds host `::` on port 8080** (not Vite's default 5173). The api serves on port 3000 (compose).
- **`web/tsconfig.app.tsbuildinfo` / `web/tsconfig.node.tsbuildinfo` are committed** (policy unchanged — A6). Their contents are relative paths, so they survive the move; a stale one self-heals on the next `tsc -b` (regen verified byte-identical) — commit the regenerated file if a legit path change lands.
- **CI** runs the same gates on GitHub Actions (push/PR to `main` and `epic/**`): web = pnpm frozen install → `tsc -b` → eslint → vitest → `vite build`; api = rubocop → rspec. Keep local green before pushing.
- `api/README.md` is still the Rails generator stub — the api's real doc is `api/AGENTS.md`.
- `lovable-tagger` is still a `web/` devDependency and runs as a dev-mode Vite plugin (`componentTagger`) — Lovable-scaffold residue that is inert at build time; removal belongs to a web-tooling change, not a docs edit.

## Agent skills

### Issue tracker

Issues live as local markdown under `.scratch/` (solo-dev repo — GitHub Issues closed 2026-11-02, kept as archive; spec/ticket history: `.scratch/phase-1/epic-01-foundation/`). Epic trackers live two-level: `.scratch/phase-<N>/epic-<NN>-<slug>/` (e.g. `phase-2/epic-00-monorepo/`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as `Status:` lines in ticket files; `done` marks completed work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`, read per the consumer rules in `docs/agents/domain.md`.

### Planning workflow

BMAD owns product thinking: `/bmad-product-brief` → `docs/product/`, `/bmad-ux` → `docs/design/`, `/bmad-architecture` → `docs/architecture/` (spine with stable decision IDs). Matt Pocock skills own implementation: `/grill-with-docs` → `/to-spec` → `/to-tickets`, then `/tdd` / `/implement` / `/code-review`. One spec pipeline per feature; tickets reference spine decision IDs. See `docs/agents/workflow.md`.

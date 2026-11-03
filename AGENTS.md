# AGENTS.md

## What this is

**Synapse** — a bilingual (中文/English) AI-powered study web app, built as the COMP5241 (Software Engineering, PolyU) course project. The brand stays "Synapse" in Chinese contexts too — no translated Chinese name. Scaffolded from a Lovable export: Vite 5 + React 18 + TypeScript + shadcn/ui + Tailwind 3.

Fresh restart repo (started from zero, Nov 2026). The previous BMad-era implementation is archived at `../project-new-archive-20261101` — do not confuse its structure/epics with this codebase.

**Core product concept (approved brief + final PRD, 2026-11-01 — [brief](docs/product/brief-synapse/brief-synapse.md) · [PRD](docs/product/prd-synapse/prd-synapse.md)):** AI-guided study platform, AI-only (no manual mode — owner removed the old ai/non-ai comparison concept). **Study Plan is the front door** (system gives the plan, never content; users attach their own materials; roadmap.sh roadmaps import as ready-made plans). Study Task = plan-free single-document study. Mastery Score 0–100% per node/plan; 100% = exam/interview readiness; evidence-only (marking = claim + confirm quiz). Sidebar = 4 aggregated hubs (Mistakes, Today/今日学习 — daily task list, not a calendar, Flashcards, Quiz); generation happens in-flow (PRD FR-36). Quiz = Open + Choice (+Mix), strictly materials-sourced. Phase 1 (Nov 6): entry states, Study Task, reader + page-aware Companion, quiz, working Mastery Score, persistence, deployment. **Retained destinations (owner round 2026-11-01):** the scaffold's ten-page nav — Dashboard/仪表盘, AI Tutor/AI 导师, Materials, Quiz, Flashcards, Mistakes, Planner, Achievements/成就, Analytics/数据分析 + the sidebar's user-profile footer and Settings gear — stays alongside the plan-first build (PRD FR-25/26/28/36/46; UX spine IA table). Dual-mode legacy (`LearningModeContext`, `aiOnly` gating, mode toggle, onboarding mode step) is removed in the first implementation pass (2026-11-01).

## Commands

```bash
npm install        # first step — no lockfile, no node_modules committed
npm run dev        # Vite dev server on http://localhost:8080 (NOT 5173)
npm run build      # vite build only — does NOT typecheck
npx tsc -b         # explicit typecheck (no `typecheck` script exists)
npm run lint       # eslint 9 flat config
npm run test       # vitest run (watch: npm run test:watch)
```

Tests: Vitest, jsdom env, globals on, setup in `src/test/setup.ts`; place tests as `src/**/*.{test,spec}.{ts,tsx}`.

Playwright config (`playwright.config.ts`) imports `lovable-agent-playwright-config`, which is **not in package.json** — e2e won't run locally until that dep is added; no e2e specs exist yet.

## Architecture

- `src/App.tsx` — all routes. `/` = OnboardingPage; all other pages nest under `AppLayout` (sidebar shell).
- `src/pages/` — one file per route: dashboard, ai-tutor, materials, quiz, flashcards, mistakes, planner, achievements, analytics, settings.
- `src/contexts/` — three providers, mounted in App.tsx in order: `LanguageProvider` → `ThemeProvider` → `UserProgressProvider`. Consume via `useLanguage()` / `useTheme()` / `useUserProgress()` (hooks throw outside their provider).
- `src/components/ui/` — shadcn/ui primitives (Radix + CVA). Treat as generated code; put app-specific reusable components in `src/components/shared/`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge); use it for all conditional classes.
- No backend yet: `UserProgressContext` seeds in-memory mock data (resets on reload). Only persistence is localStorage: `synapse-lang` (renamed from `studyflow-lang` in the 2026-11-01 product rename) and the theme keys `synapse-theme` / `synapse-mode` / `synapse-motion` (2026-11-02 pass 7; see `docs/design/northstar-import/IMPORT.md` §11). TanStack Query is mounted but has no API layer yet.

## Conventions

- **Path alias:** `@/*` → `src/*`. It is declared in four places that must stay in sync: `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`/`tsconfig.app.json`.
- **i18n is mandatory:** never hardcode user-facing strings. Add a dotted key with `{ zh, en }` to the `translations` table in `src/contexts/LanguageContext.tsx` and render via `t("dotted.key")` from `useLanguage()`; `{var}` interpolation is supported.
- **TypeScript is deliberately loose:** `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, unused-vars/params checks off (also `@typescript-eslint/no-unused-vars` off in eslint). Don't tighten these or bulk-annotate types in unrelated edits.
- **Tailwind:** theme colors are CSS-variable/HSL tokens defined in `src/index.css` and mapped in `tailwind.config.ts` — use semantic classes (`bg-background`, `text-muted-foreground`, `bg-primary`), not raw palette classes. Never hardcode whites (`bg-white/…`) or coral `rgba()` values — they break dark mode and the theme palettes; use the glass (`--glass-*`) and accent-tint (`--accent-tint*` / `--accent-ring` / `--accent-edge`) tokens instead. The app ships dark mode + sunset/twilight/aurora palettes (`ThemeProvider`) — verify UI in both modes. Custom fonts: `font-display` (Source Serif 4) / `font-body` (Inter). Custom animations exist (`animate-pop`, `animate-slide-up`, `animate-confetti`, …).
- Both the shadcn `<Toaster />` and `<Sonner />` are mounted in App.tsx — pick one pattern for toasts and stay consistent.

## Gotchas

- `npm run build` passing ≠ types are fine. Run `npx tsc -b` when type safety matters.
- HMR error overlay is disabled (`vite.config.ts`), so dev errors only appear in the terminal — watch it, not just the browser.
- Dev server binds host `::` on port 8080.
- `tsconfig.*.tsbuildinfo` files are committed; incremental typecheck artifacts may need `tsc -b --clean` if stale.
- `README.md` is still the Lovable template stub — this file is the real project doc.

## Agent skills

### Issue tracker

Issues live as local markdown under `.scratch/` (solo-dev repo — GitHub Issues closed 2026-11-02, kept as archive; spec/ticket history: `.scratch/phase-1/epic-01-foundation/`). Epic trackers live two-level: `.scratch/phase-<N>/epic-<NN>-<slug>/` (e.g. `phase-2/epic-00-monorepo/`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as `Status:` lines in ticket files; `done` marks completed work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`, read per the consumer rules in `docs/agents/domain.md`.

### Planning workflow

BMAD owns product thinking: `/bmad-product-brief` → `docs/product/`, `/bmad-ux` → `docs/design/`, `/bmad-architecture` → `docs/architecture/` (spine with stable decision IDs). Matt Pocock skills own implementation: `/grill-with-docs` → `/to-spec` → `/to-tickets`, then `/tdd` / `/implement` / `/code-review`. One spec pipeline per feature; tickets reference spine decision IDs. See `docs/agents/workflow.md`.

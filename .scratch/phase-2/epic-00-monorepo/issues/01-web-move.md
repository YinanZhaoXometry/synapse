# 01: Move the Vite SPA into `web/`, gates green from the new layout

**What to build:** the whole SPA and its tooling live under `web/` at the repo root's side, per AD-17 — the app runs, every gate passes, and nothing about the product changed. This is the epic's wide-refactor expand step: one mechanical move, zero behavior change; the 411-test suite is expected to pass **unmodified** (any test edit is a smell — imports don't change because the path alias is relative to the moved root).

**Blocked by:** None (can start immediately).

**Status:** done 2026-11-03 — 3df9fb2 + review fixes f7d610f..96eb1ea, merged into epic/p2-0-monorepo (merged to main 2026-11-03)

**Bound by:** AD-17 (repo shape, docs/.scratch stay put), AD-2 (feature-boundary paths gain the `web/` prefix, rules unchanged).

- [x] Move manifest lands: `src/`, `public/`, `index.html`, Vite/Vitest/eslint/postcss/tailwind configs, tsconfigs, `components.json`, Playwright config files, `package.json`, `pnpm-lock.yaml` — all under `web/`; `docs/`, `.scratch/`, root AGENTS.md / README.md / GLOSSARY.md, `.git*` stay at root; `dist/` not moved (regenerates under `web/`); tsbuildinfo files move with their configs, commit policy unchanged (A6)
- [x] All four web gates green from `web/` via the lockfile-honest toolchain (pnpm / direct `node_modules/.bin` calls — never bare npm/npmx, A4): `tsc -b`, eslint, vitest 411/411 with zero test-file edits, `vite build`
- [x] Dev server boots from `web/` and a quick smoke passes (first-run → `/plans` front door)
- [x] `web/.nvmrc` pins the current dev Node major.minor (A5 — repo has none today)
- [x] Root AGENTS.md is intentionally stale mid-branch (its rewrite is ticket 05); the *merged* state must not be — noted, not fixed, here

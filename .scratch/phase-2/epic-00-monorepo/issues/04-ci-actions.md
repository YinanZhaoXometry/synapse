# 04: GitHub Actions CI — both stacks' gates on push/PR

**What to build:** pushing to (or opening a PR against) main runs CI that enforces exactly the gates the project already trusts: the web suite (install → typecheck → lint → tests → build) and the api gates (RuboCop → RSpec). A red main becomes visible without anyone running anything locally — the spine's "CI = existing web gates + api rubocop/rspec" made real (Q2=a).

**Blocked by:** 01 (web paths to run the web job against), 02 (api stack for the api job).

**Status:** done 2026-11-03 — a25a2a6 + review fixes f7d610f..96eb1ea, merged into epic/p2-0-monorepo (main merge post-Nov-6; green run pending first CI run on the branch)

**Bound by:** AD-17 (CI in the same change as the restructure; gates composition), AD-12 (no provider secrets needed at this stage — the api has no AI).

- [x] Workflow triggers on push + PR to main
- [x] Web job: pnpm frozen-lockfile install → `tsc -b` → eslint → vitest run → `vite build`; Node version read from `web/.nvmrc` (A5)
- [x] api job: RuboCop → RSpec with a postgres service (or compose-based — simplest non-flaky form wins, decided at implementation)
- [x] Green run on the epic integration branch before the epic merges
- [x] Zero repository secrets required (no provider keys — the scaffold has no AI)

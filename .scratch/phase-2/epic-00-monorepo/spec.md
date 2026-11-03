# Spec: Epic 0 (Phase 2) — Monorepo restructure: `web/` + `api/` + justfile + CI (Phase-2 opener)

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Grill round closed 2026-11-03 — one frontier round, three questions (api scaffold depth · CI form ·
> CF Pages sequencing). Owner answered 「继续」 under the standing decide-all delegation: all three
> recommendations adopted ((a) minimal bootable api scaffold · (a) GitHub Actions · (b) owner configures
> Pages now per the current deploy doc, this epic re-points it after landing). Assumption log in
> Further Notes. **Implementation starts post-Nov-6** (spine: "design now, implementation post-Nov-6") —
> this spec + tickets are the pre-Nov-6 deliverable.

## Problem Statement

The Phase-2 architecture is decided (AD-12…20) but the repo has no shape for it. Everything lives flat at the root as a Vite SPA, so a Rails api has no unambiguous home; there is no single command to bring a stack up or run the gates; nothing verifies the gates on push (no CI at all — `.github/` is empty), so a red main is only discovered at the next local session. Meanwhile the repo's self-description has drifted from reality: the root AGENTS.md tells agents to run npm commands that crash on this machine's pnpm node_modules layout + nvm shim, its storage-key names are stale (`studyflow-lang` on disk, per epic-7's closure observation), and README.md is still the Lovable scaffold stub. Every future backend epic would start from ad-hoc paths and an unverified api.

## Solution

Restructure mechanically per AD-17 into **`web/` + `api/` + a root `justfile`**, with `docs/`/`.scratch/` staying put and **no shared code package** — the only cross-stack contract is api-committed `schema.graphql`.

- **`web/`**: the Vite SPA moves wholesale — zero behavior change; the 411-test suite is the acceptance bar and is expected to pass **unmodified**.
- **`api/`**: a *minimal, bootable* Rails 8.1 API-only scaffold — GraphQL endpoint with one health query, `schema.graphql` dumped and committed as the contract, colocated RSpec + RuboCop green, and `.dockerdev/compose.yaml` (postgres 17 + api) so `just up` boots a working api. **No business commands, models, or AI code** — those belong to the later backend epics.
- **Root justfile**: `setup · dev · up · spec` orchestrating both stacks, called through the lockfile-honest package manager (pnpm — see A4).
- **CI**: a minimal GitHub Actions workflow running the web gates and the api gates on push/PR to main.
- **Docs in the same change**: root AGENTS.md rewritten for the monorepo (true commands, pnpm/nvm reality, corrected storage-key names — closing epic-7's observation), `api/AGENTS.md` authored as the api's architecture contract from the spine, the deploy doc re-pointed to the `web/` build values (one-line Cloudflare Pages edit on the owner side afterwards), and README rewritten from the Lovable stub.

## User Stories

1. As the owner, I want the Vite app to live under `web/`, so that the api has an unambiguous home beside it and AD-17's shape is real.
2. As the owner, I want the move to be purely mechanical, so that zero web behavior changes and the 411/411 suite stays the acceptance bar.
3. As the owner, I want a bootable api after `just up`, so that every backend epic starts from green instead of from scaffolding.
4. As the owner, I want one health query in the api, so that "the stack is up" is provable with a single request.
5. As the owner, I want `schema.graphql` committed in `api/`, so that the cross-stack contract exists on day one and web's codegen has something real to consume.
6. As the owner, I want graphql-codegen wired in `web/` against that schema, so that the contract→client pipeline is proven end-to-end before any real query exists.
7. As the owner, I want a root justfile with `setup/dev/up/spec`, so that starting a session never requires remembering per-stack incantations.
8. As the owner, I want justfile targets to call the package manager that matches the only lockfile on disk (pnpm), so that commands don't crash on the pnpm node_modules layout.
9. As the owner, I want CI on GitHub Actions running both stacks' gates, so that a red main is visible without running anything locally.
10. As the owner, I want `web/.nvmrc` pinning the Node version, so that local dev and CI run the same runtime.
11. As the owner, I want the api to run only inside its dev containers, so that my local Ruby version is irrelevant to api work.
12. As the owner, I want the root AGENTS.md rewritten, so that agent sessions read true commands, true storage-key names, and the pnpm/nvm gotchas instead of crashing on stale instructions.
13. As the owner, I want `api/AGENTS.md` authored as the api's architecture contract, so that backend tickets cite one canonical doc instead of re-deriving AD-12…16/19 each time.
14. As the owner, I want the deploy doc re-pointed to the `web/` build values, so that the post-merge Cloudflare Pages fix is a one-line dashboard edit.
15. As the owner, I want README.md to describe Synapse (not Lovable), so that any visitor or grader reads the real product and structure.
16. As CI, I want the web job to run install → typecheck → lint → tests → build, so that the exact gates the project already trusts are enforced on every push.
17. As CI, I want the api job to run RuboCop → RSpec, so that api regressions are caught before later epics build on the scaffold.
18. As a future backend epic, I want the api scaffold's naming and error posture to already encode the AD-12 conventions in `api/AGENTS.md`, so that each ticket inherits them without re-reading the whole spine.
19. As the course grader, I want this epic to land only after Nov 6, so that the Phase-1 demo runs on the untouched, already-shipped static build.
20. As the owner, I want rollback to be "revert one merge", so that the restructure can never strand the web app.

## Implementation Decisions

- **AD-17 shape is binding**: root = `web/` + `api/` + `justfile` (+ root docs: AGENTS.md, README.md, `docs/`, `.scratch/`, `.git*`, `.github/`). No `apps/` nesting, no shared package. `docs/` and `.scratch/` do **not** move.
- **Move manifest (by category)**: `web/` receives the SPA and its tooling — `src/`, `public/`, `index.html`, the Vite/Vitest/eslint/postcss/tailwind configs, the tsconfigs (alias `@/*` → `src/*` is *relative* and survives the move unchanged), `components.json`, the Playwright config files (moved as-is; e2e remains the known unrunnable debt), `package.json`, `pnpm-lock.yaml`. The `dist/` build output is not part of the move (regenerates); tsbuildinfo files move with their configs and keep their committed status (policy unchanged — A6).
- **api scaffold scope (Q1=a)**: Rails 8.1 API-only (≥ 8.1.4, verified in the spine 2026-11-03), graphql-ruby 2.5.x, puma, pg, rspec-rails + factory_bot_rails + rubocop + strong_migrations (spine stack table; exact gems pinned at scaffold). Exactly one GraphQL health query; `schema.graphql` dumped and committed; `.dockerdev/compose.yaml` with postgres 17 + the api service. Solid Queue is *not* installed in this epic — its AD-19 posture is documented in `api/AGENTS.md` and the gem lands with the first epic that has a named job (FR-24 re-queue) (A9). No commands, no models, no auth, no AI adapter — later epics own those.
- **Justfile targets**: `setup` (web package install + api image build/pull), `dev` (web Vite only — the api has no web-facing behavior until the Apollo cutover), `up` (compose: postgres + api), `spec` (web gates + api gates). Deviation from AD-20's full local shape (minio) is deliberate: minio joins when the ActiveStorage/R2 epic lands (A7).
- **Package manager honesty (A4)**: the only lockfile on disk is `pnpm-lock.yaml`; npm-shell commands crash on this machine (pnpm node_modules layout + nvm shim — re-confirmed 2026-11-03). Justfile and CI therefore call **pnpm**; package.json script names stay PM-agnostic so the spine's "npm run codegen" reads as "the script named `codegen`". AGENTS.md documents this reality instead of the stale npm instructions.
- **CI (Q2=a)**: one workflow (or two jobs) on push/PR to main. Web job: pnpm frozen install → `tsc -b` → eslint → vitest run → `vite build`, Node pinned via `web/.nvmrc` (pin captured at implementation — A5). api job: RuboCop → RSpec (postgres as a service container or compose-based, whichever keeps the workflow simplest; decide at ticket time within "gates green, no flakiness").
- **Codegen pipeline**: `web/` gets a `codegen.ts` + `codegen` script consuming `../api/schema.graphql`, emitting typed output into a gitignored/generated location; compile-level proof only (no runtime GraphQL client — that's AD-18's cutover epic).
- **Docs pass**: root AGENTS.md rewrite (monorepo commands + gotchas: pnpm layout, nvm shim hijack, `npm run build` ≠ typecheck, dev port 8080, tsbuildinfo staleness, **corrected storage-key names** — closing epic-7's out-of-scope observation); `api/AGENTS.md` new (architecture contract: command-layer-first per AD-12, closed error enum ↔ `AppError.code` 1:1 via `extensions.code`, client-suppliable UUIDs, AD-16 AI server-side + SSE ticket contract, AD-19 jobs posture, naming conventions — each rule citing its AD id); deploy doc re-pointed (root directory `web`, build command, output `dist`) with an explicit note that the owner must edit the Pages project's root directory once after merge (Q3=b); README rewritten (product intro, structure map, `just` quickstart).
- **Delivery process**: single integration branch off main (established pattern), implementation starts post-Nov-6, two-axis review (spec-conformance + defects) before merge, CI green pre-merge. Rollback = revert the merge.

## Testing Decisions

- **One seam: the gate suite.** A restructure must add zero abstraction and zero new seams. Everything is verified through the existing gates, unified under `just spec` and mirrored in CI:
  - **Web**: the existing 411-test Vitest suite plus `tsc -b`, eslint, and a successful `vite build` from `web/`. Any test *edit* during the move is a smell — the suite is expected to pass unmodified (tests move together with `src/`; the alias is relative, so imports don't change).
  - **api**: colocated RSpec smoke — the health query returns ok and the committed `schema.graphql` is reproducible from a schema dump (dump is idempotent / no diff); RuboCop clean. In-repo prior art: none (first api code) — the reference is qc-center-api's conventions per the spine.
  - **Stack-up check**: `just up` boots compose and the health query answers over HTTP (manual acceptance step in the api ticket).
  - **Contract check**: `pnpm codegen` in `web/` emits typed output against the committed schema without error (compile-level).
- What makes a good test here: it observes *behavior at the seams above* (suite green, build green, health query answers, schema dumps clean) and never asserts internal file locations beyond the manifest itself.

## Out of Scope

- Any api business logic: commands, models, auth (AD-15), AI adapter + SSE (AD-16), ActiveStorage/R2 + minio (A7), Solid Queue installation (A9), migrations beyond Rails defaults, GraphQL operations beyond the health query.
- The Apollo Client swap and TanStack Query retirement (AD-18) — that's the cutover epic, not this one.
- The owner-side Cloudflare Pages dashboard edits (Q3=b: owner configures per the *current* doc this week; re-points the root directory after this epic merges).
- e2e: the Playwright config moves as-is; its missing dependency stays the known debt.
- Any web behavior change, dependency add/remove in `web/` beyond graphql-codegen's dev tooling, or theme/i18n work.
- Re-milestoning or touching Phase-1 trackers (`docs/`, `.scratch/` history is read-only context for this epic).

## Further Notes

**Assumption log** (standing decide-all delegation, 2026-11-03):
- **A1** — grill round resolved by 「继续」: Q1=(a) bootable api scaffold · Q2=(a) GitHub Actions · Q3=(b) Pages configured now, re-pointed post-merge.
- **A4** — pnpm is the lockfile-honest package manager for justfile + CI; spine's "web stays on its incumbent npm toolchain" is read as "npm-*style scripts stay*, the reference's pnpm *workspace scripts* are not adopted", not as a lockfile migration (migrating to package-lock would be a real change to the incumbent and breaks the owner's machine).
- **A5** — `web/.nvmrc` pins the current dev Node (exact value captured at implementation; the repo has none today).
- **A6** — tsbuildinfo commit policy unchanged (move with their configs; no policy change smuggled into a mechanical epic).
- **A7** — minio deferred to the ActiveStorage/R2 epic; AD-20's full local-dev shape completes then.
- **A8** — single test seam (the gate suite) chosen per delegation; to-spec's "check seams with the user" satisfied by this logged assumption.
- **A9** — Solid Queue gem deferred to the first epic with a named job; posture documented in `api/AGENTS.md`.

**Facts captured 2026-11-03**: remote re-pointed to `github.com/YinanZhaoXometry/synapse` (old `comp5241-project` remote still pushable; set-url was the standing recommendation); Docker 29.5.3 installed, daemon down at spec time (compose targets unaffected); local Ruby 3.2.6 (irrelevant — api runs in containers); repo has no `.nvmrc`; the nvm shim failure (`command not found: _nvm_lazy_load`) reproduced in-session.

**Sequencing constraint**: implementation begins **after** the Nov-6 demo (spine line: "design now, implementation post-Nov-6"). Owner's CF Pages setup (epic-7 T1) proceeds this week against the *current* layout per Q3=(b).

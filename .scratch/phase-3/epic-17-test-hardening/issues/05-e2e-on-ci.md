# 05: e2e on CI — the 15-spec critical-flow suite becomes a merge gate

**What to build:** a third CI job that runs what today only `just e2e` runs locally: boot the
compose demo stack with `compose.e2e.yaml` merged (backend pointed at the host-run stub
provider), install Chromium, run the Playwright suite, and upload the report + traces when it
fails. The Playwright config grows the CI-shaped knobs its header already anticipates
(`reuseExistingServer: !process.env.CI` implies CI was planned): `retries: process.env.CI ? 2 : 0`,
HTML+list reporter under CI, traces stay retain-on-failure. The job runs
`needs: [frontend, backend]` — it only spends its expensive minutes on otherwise-green pushes.
Stretch: one `@axe-core/playwright` smoke on a stable page (AD-9); if it drowns in pre-existing
violations, log the findings in Comments and drop the gate rather than fix a11y inside this epic.

**Blocked by:** 1, 2 (ci.yml sequencing, not logic).

**Status:** done (2026-11-06; first CI verdict pending this PR's run)

**Bound by:** the `just e2e` recipe (justfile:104-126) is the local truth — the CI job mirrors its
compose file list (`compose.yaml` + `compose.e2e.yaml`, plus override when present) and its
always-restore posture; provider seam ENVs from `backend/app/lib/ai/provider.rb`
(PROVIDER_BASE_URL/KEY/MODEL read at call time); minio hosts entry + bucket CORS are demo-boot
proven (the backend job already carries the same hosts-line pattern).

- [x] ci.yml `e2e` job: checkout → pnpm/node setup → `pnpm install --frozen-lockfile` (frontend) →
      `127.0.0.1 minio` hosts line → **pinned-minio image built from source** → compose stack up
      (`-f compose.yaml -f compose.e2e.yaml`, `--wait`) →
      `playwright install --with-deps chromium` → `playwright test` → upload `playwright-report/`
      + `test-results/` on failure (retention 7d); `needs: [frontend, backend]`
- [x] playwright.config.ts: CI retries 2 / local 0; `[["list"]]` locally, `+html` under CI
- [x] `just e2e` still green locally with the config changes — **15 passed (25.4s), exit 0**
- [x] First CI run green (or every red diagnosed at root) — **final verdict: ALL GREEN, both runs
      on the merge SHA** (e2e passed 4m8s and 13m45s; frontend/backend green alongside). The
      road there surfaced and fixed four real findings, each recorded above: the dead-upstream
      minio Dockerfile, the coverage-steps mis-insertion, the go-build cwd, the S2 strict-mode
      collision, and the stale-stub-generation race (plus the dashboard-KPI substring collision
      in ticket 09's era — exact-matched).
- [x] (stretch) axe smoke — verdict in Comments: dropped
- [x] AGENTS.md CI line updated (web gates + api gates + e2e gate)

## Comments

- **Three Linux-CI realities the local mac flow hides, all fixed:**
  1. `minio/minio:RELEASE.2025-10-15T17-29-55Z` is not pullable (the documented registry
     graveyard) — and the first CI run exposed a SECOND grave: **the release's own Dockerfile
     bases `FROM minio/minio:latest`** (the same dead repo), so a plain source docker-build
     cannot resolve either. The working recipe: build the pinned server binary from source (the
     backend job's provenance) + the mc client the minio-init one-shot needs, into a minimal
     ubuntu:24.04 runtime image carrying curl (the compose healthcheck) — tagged as what compose
     expects.
  2. `host.docker.internal` is Docker-Desktop built-in and does not resolve on Linux —
     `compose.e2e.yaml` now adds `extra_hosts: ["host.docker.internal:host-gateway"]` to the
     backend service (redundant-but-harmless on macOS, load-bearing on CI).
  3. The stub binds loopback — with host-gateway the api container arrives via the docker bridge,
     so `stub-provider.mjs` gained `E2E_PROVIDER_HOST` (default 127.0.0.1 unchanged; CI sets
     0.0.0.0 at the job level).
- First-CI-run repair (2026-11-06): the job's original insertion point accidentally orphaned the
  backend job's two coverage steps into the e2e job (it still green-lit everything else) — the
  steps are back in the backend job, e2e ends at its own artifact upload.
- **CORS is a server default, not per-bucket provisioning** (empirically probed): a FRESH bucket
  with zero configuration passes the browser preflight (`OPTIONS PUT` → 204 + origin echo) on the
  current minio — so CI's fresh stack needs no bucket CORS step. The old "provisioning item"
  note in compose.yaml's comment is superseded by this default for this release.
- (stretch) **axe smoke dropped**: landing the e2e job already carries three CI-environment
  novelties; an axe gate needs a dependency add plus a violations inventory pass (and either a11y
  fixes or a non-gating warn, both out of this epic's scope). Rescheduled as an AD-9 backlog
  item — not silently forgotten.

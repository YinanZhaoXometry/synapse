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

**Status:** ready-for-agent

**Bound by:** the `just e2e` recipe (justfile:104-126) is the local truth — the CI job mirrors its
compose file list (`compose.yaml` + `compose.e2e.yaml`, plus override when present) and its
always-restore posture; provider seam ENVs from `backend/app/lib/ai/provider.rb`
(PROVIDER_BASE_URL/KEY/MODEL read at call time); minio hosts entry + bucket CORS are demo-boot
proven (the backend job already carries the same hosts-line pattern).

- [ ] ci.yml `e2e` job: checkout → pnpm/node setup → `pnpm install --frozen-lockfile` (frontend) →
      `127.0.0.1 minio` hosts line → compose stack up
      (`-f backend/.dockerdev/compose.yaml -f backend/.dockerdev/compose.e2e.yaml`, `--wait`) →
      `playwright install --with-deps chromium` → `playwright test` → upload `playwright-report/`
      + `test-results/` on failure (retention 7d)
- [ ] playwright.config.ts: CI retries 2 / local 0; `[["list"]]` locally, `+html` under CI
- [ ] `just e2e` still green locally with the config changes
- [ ] First CI run green (or every red diagnosed at root: image build time, stub readiness, port
      collisions — no suite skips)
- [ ] (stretch) axe smoke verdict recorded in Comments — landed or dropped with findings
- [ ] AGENTS.md CI line updated (web gates + api gates + e2e gate)

## Comments

- (none yet)

import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

/**
 * The e2e harness (critical-flow suite, 2026-11-06). Replaces the scaffold
 * `lovable-agent-playwright-config` import — that package was never installed,
 * so this config could not even load (same residue family as lovable-tagger,
 * removed 2026-11-06).
 *
 * What a run needs — or just run `just e2e` (root justfile), which flips the
 * backend to the stub, runs the suite, and restores the demo stack:
 *   1. The backend stack with the STUB provider wired in (compose only merges
 *      extra files when the invocation lists them — the deploy.md §1 rule):
 *
 *        docker compose \
 *          -f backend/.dockerdev/compose.yaml \
 *          -f backend/.dockerdev/compose.override.yaml \
 *          -f backend/.dockerdev/compose.e2e.yaml up -d --wait
 *
 *      (drop the override file from the command when it does not exist;
 *      compose.e2e.yaml points PROVIDER_BASE_URL at the local stub, so no live
 *      AI is ever called and no GLM key is needed).
 *   2. The Vite dev server on :8080 — `just dev`, or let Playwright start it
 *      (reuseExistingServer keeps an already-running one).
 *   3. The dev upload prerequisites from compose.yaml's comment: a
 *      `127.0.0.1 minio` /etc/hosts entry + bucket CORS (the demo boot on
 *      this machine already has both).
 *
 * Run:  pnpm exec playwright test   (or: pnpm run test:e2e, from frontend/)
 */
const stubPort = Number(process.env.E2E_PROVIDER_PORT || 8791);

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  // One worker, file order: the study-loop spec is a serial learner journey
  // over the shared dev database — tests never run against each other.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8080",
    // The UI's language defaults to zh (the synapse-lang key is lazy-written,
    // reads fall back to zh) — pin the locale so the zh selectors are stable.
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // The deterministic AI double — always started; a stray one on the port
      // is reused (same deterministic contract, so reuse is safe).
      command: `${process.execPath} e2e/stub-provider.mjs`,
      url: `http://127.0.0.1:${stubPort}/healthz`,
      reuseExistingServer: true,
      env: { ...process.env, E2E_PROVIDER_PORT: String(stubPort) },
      timeout: 15_000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:8080",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
};

export default config;

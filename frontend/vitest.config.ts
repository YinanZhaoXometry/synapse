import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Coverage measurement (epic P3-17 ticket 02). `all: true` counts untested
    // src files at 0% — the honest denominator. Excludes: the test harness and
    // integration walks live in src/test (not shippable code), src/types is
    // graphql-codegen output (generated — AGENTS.md forbids hand edits).
    // Thresholds are a ratchet pinned at close-out (epic-17 ticket 10).
    coverage: {
      provider: "v8",
      all: true,
      // vitest 4: the uncovered-file sweep genuinely PARSES every included
      // file — src/** also matched the .graphql operation documents and css,
      // which PARSE_ERROR and understate coverage. TS/TSX only (the honest
      // denominator is code, not generated documents).
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/test/**", "src/types/**", "src/**/*.d.ts"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Ratchet, not target (epic-17 decision 7). Re-measured 2026-11-08 at
      // 73 lines / 70.97 branches / 71.2 functions / 74.02 statements under
      // the vitest-4 v8 provider (its remap counts branches/functions on a
      // different model than vitest 3's — same 1011-test suite, same code;
      // lines went UP, the branch/function denominators grew). Floors sit
      // two points under the measured values and rise only with real coverage.
      thresholds: { lines: 71, branches: 69, functions: 69, statements: 72 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

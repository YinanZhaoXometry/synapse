import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
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
      include: ["src/**"],
      exclude: ["src/test/**", "src/types/**", "src/**/*.d.ts"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Ratchet, not target (epic-17 decision 7): measured 2026-11-06 at
      // 67.65 lines / 85.4 branches / 79.93 functions (the 0% tail is the
      // shadcn primitives — the honest denominator stays); floors sit two
      // points under the measured values and rise only with real coverage.
      thresholds: { lines: 65, branches: 83, functions: 77, statements: 65 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

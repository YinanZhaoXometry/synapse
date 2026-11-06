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
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

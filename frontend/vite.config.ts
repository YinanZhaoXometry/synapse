import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Cutover dev plumbing (epic P2-8 T1): the api answers /graphql and the
    // SSE surface /api/stream on :3000 (`just up`). Proxying keeps the
    // browser same-origin in dev — no CORS wiring until ticket 06's deployed
    // envelope (CORS_ORIGIN). The client's default uri is the relative
    // /graphql; VITE_API_URL overrides for a deployed build.
    proxy: {
      "/graphql": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/stream": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  build: {
    // Soft size tripwire (epic-19 T1, spec decision 5) — derived from the
    // measured post-split entry, it warns and gates nothing:
    // entry `index-*.js` measures 723,680 B minified / 202,315 B gzip
    // (gzip -k + ls, see .scratch/phase-3/epic-19-bundle-split/bundle-report.md)
    // = ~707 KiB. ~10% headroom → ~777 KiB, ceil to the sane round ceiling
    // 800 (vite compares raw chunk bytes against limit × 1000, so 800 here
    // trips at 800,000 B — 76 kB ≈ 10.5% of headroom over the entry). The
    // reader-only pdfjs worker (1.3 MB, lazy) still trips it by design —
    // known, stable, and paid only on PDF read; the 558 kB pdf chunk sits
    // under the limit and stays quiet.
    chunkSizeWarningLimit: 800,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  optimizeDeps: {
    // Pre-bundle the WHOLE shadcn/radix surface + the icon/toast workhorses
    // (2026-11-10): lazy DEPENDENCY discovery re-ran the optimizer
    // mid-session whenever a lazy route first imported a not-yet-bundled dep
    // — the "Outdated Optimize Dep" 504 that white-screened the confirm-
    // create navigation. Listed here they bundle at dev-server START and a
    // live session never re-optimizes. KEEP IN SYNC with package.json's
    // @radix-ui/* set (a newly added radix dep must land here too).
    include: [
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "lucide-react",
      "sonner",
    ],
  },
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

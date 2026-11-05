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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

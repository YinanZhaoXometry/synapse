# Deployment — Cloudflare Pages (AD-11, FR-35)

Phase 1 ships as a static SPA. **AD-11 (2026-11-03):** `vite build` → static bundle → **Cloudflare Pages**, SPA-fallback rewrite to `index.html`, auto-deploy from `main`. No env vars, no server, no warm-up (NFR-6). The Phase-2 backend envelope (Render/Neon/R2) is AD-20 and does not apply here.

## Repo-side (already in place)

- `public/_redirects` — SPA fallback (`/*  /index.html  200`). Vite copies `public/*` into `dist/` verbatim, so the file lands at the build-output root where Pages reads it. Without it, a hard refresh on a deep route (`/plans`, `/read/<id>`, …) 404s.
- Build: `node_modules/.bin/vite build` (pnpm layout — never `npm`/`npx`). Output dir: `dist` (vite default, no override in `vite.config.ts`).
- No env vars or host-specific config: the app is client-only; persistence is localStorage (`synapse-db:v1` + `synapse-*` UI keys). Nothing to set in the Pages dashboard beyond build settings.

## Owner one-time setup (dashboard click-through)

Wrangler is not used — the project is created once via git integration:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize GitHub and pick `YinanZhaoXometry/synapse`.
3. Build settings:
   - Framework preset: **None** (or Vite, same result)
   - Build command: `vite build`
   - Build output directory: `dist`
   - Environment variables: none
   - Node version: Pages default (vite 5 needs Node ≥ 18; leave default unless the build log says otherwise)
4. **Save and Deploy.** First deployment gives a `*.pages.dev` https URL — that is the shareable live-demo URL (custom domain optional, not required).
5. After it's green, verify: open the URL in a fresh browser profile → onboarding entry state loads; hard-refresh a deep route → app renders (no 404).

## Rollback

Pages keeps every deployment: dashboard → the Pages project → **Deployments** → pick the last-good deployment → **…** menu → **Rollback to this deployment**. Instant, no rebuild.

## Redeploying (every later epic)

Auto-deploy is on `main`: merge/push to `main` → Pages builds and publishes automatically. No manual step. (Check the project's **Deployments** tab if a push doesn't go live.)

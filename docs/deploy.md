# Deployment — Cloudflare Pages (AD-11, FR-35)

Phase 1 ships as a static SPA. **AD-11 (2026-11-03):** `vite build` → static bundle → **Cloudflare Pages**, SPA-fallback rewrite to `index.html`, auto-deploy from `main`. No env vars, no server, no warm-up (NFR-6). The Phase-2 backend envelope (Render/Neon/R2) is AD-20 and does not apply to the web app. Since the monorepo restructure (AD-17) the SPA lives in **`frontend/`** — the Pages project's **Root directory is `frontend`** (deployment status below).

## Deployment status (2026-11-03)

**The owner has not configured Cloudflare Pages yet** — there is no legacy project to migrate and no re-point step. The earlier plan ("configure this week against the old layout, flip Root directory after the restructure merges" — Q3=b) is **void**: when deploying, do the fresh setup below directly with the post-restructure values (**Root directory `frontend`**, `pnpm run build`, output `dist`), and auto-deploy from `main` just works.

## Repo-side (already in place)

- `frontend/public/_redirects` — explicit SPA fallback (`/*  /index.html  200`). Vite copies `public/*` into `dist/` verbatim, so the file lands at the build-output root where Pages reads it. It pins the SPA behavior: hard refreshes on deep routes (`/plans`, `/read/<id>`, …) serve `index.html`. Pages would also auto-detect the SPA and serve `index.html` for non-asset paths when no top-level `404.html` ships (our dist has none) — so treat this file as belt-and-braces: it makes the fallback explicit rather than relying on Pages' auto-detection.
- Build (local truth): from `frontend/`, `node_modules/.bin/vite build` (pnpm layout — never `npm`/`npx` locally). Output dir: `dist` (vite default, no override in `frontend/vite.config.ts`) — relative to the Pages **Root directory**, i.e. the published artifact is `frontend/dist`. The `node_modules/.bin` rule is for this checkout's local dev only — the Pages build image (below) is a normal environment.
- No env vars or host-specific config: the app is client-only; persistence is localStorage (`synapse-db:v1` + `synapse-*` UI keys). Nothing to set in the Pages dashboard beyond build settings.

## Owner one-time setup (dashboard click-through)

Wrangler is not used — the project is created once via git integration:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize GitHub and pick `YinanZhaoXometry/synapse`.
3. Build settings — post-restructure values (pnpm-honest: the only lockfile in `frontend/` is `pnpm-lock.yaml`, so Pages installs with pnpm):
   - **Root directory: `frontend`**
   - Framework preset: **None** (the presets assume npm scripts; the fields below are the contract)
   - Build command: `pnpm run build` (package.json's `build` script is `vite build`; the script form doesn't rely on the bare `vite` binary resolving on the Pages build image)
   - Build output directory: `dist` (i.e. `frontend/dist` relative to the repo)
   - Environment variables: none
   - Node version: Pages default (vite 5 needs Node ≥ 18; leave default unless the build log says otherwise — the dev pin is `frontend/.nvmrc` = 24.22)
4. **Save and Deploy.** First deployment gives a `*.pages.dev` https URL — that is the shareable live-demo URL (custom domain optional, not required).
5. After it's green, verify: open the URL in a fresh browser profile → onboarding entry state loads; hard-refresh a deep route → app renders (no 404).

## Rollback

Pages keeps every deployment: dashboard → the Pages project → **Deployments** → pick the last-good deployment → **…** menu → **Rollback to this deployment**. Instant, no rebuild.

## Redeploying (every later epic)

Auto-deploy is on `main`: merge/push to `main` → Pages builds and publishes automatically. No manual step. (Check the project's **Deployments** tab if a push doesn't go live.)# Deployment — Cloudflare Pages (AD-11, FR-35)

Phase 1 ships as a static SPA. **AD-11 (2026-11-03):** `vite build` → static bundle → **Cloudflare Pages**, SPA-fallback rewrite to `index.html`, auto-deploy from `main`. No env vars, no server, no warm-up (NFR-6). The Phase-2 backend envelope (Render/Neon/R2) is AD-20 and does not apply to the web app. Since the monorepo restructure (AD-17) the SPA lives in **`frontend/`** — the Pages project's **Root directory is `frontend`** (deployment status below).

## Deployment status (2026-11-03)

**The owner has not configured Cloudflare Pages yet** — there is no legacy project to migrate and no re-point step. The earlier plan ("configure this week against the old layout, flip Root directory after the restructure merges" — Q3=b) is **void**: when deploying, do the fresh setup below directly with the post-restructure values (**Root directory `frontend`**, `pnpm run build`, output `dist`), and auto-deploy from `main` just works.

## Repo-side (already in place)

- `frontend/public/_redirects` — explicit SPA fallback (`/*  /index.html  200`). Vite copies `public/*` into `dist/` verbatim, so the file lands at the build-output root where Pages reads it. It pins the SPA behavior: hard refreshes on deep routes (`/plans`, `/read/<id>`, …) serve `index.html`. Pages would also auto-detect the SPA and serve `index.html` for non-asset paths when no top-level `404.html` ships (our dist has none) — so treat this file as belt-and-braces: it makes the fallback explicit rather than relying on Pages' auto-detection.
- Build (local truth): from `frontend/`, `node_modules/.bin/vite build` (pnpm layout — never `npm`/`npx` locally). Output dir: `dist` (vite default, no override in `frontend/vite.config.ts`) — relative to the Pages **Root directory**, i.e. the published artifact is `frontend/dist`. The `node_modules/.bin` rule is for this checkout's local dev only — the Pages build image (below) is a normal environment.
- No env vars or host-specific config: the app is client-only; persistence is localStorage (`synapse-db:v1` + `synapse-*` UI keys). Nothing to set in the Pages dashboard beyond build settings.

## Owner one-time setup (dashboard click-through)

Wrangler is not used — the project is created once via git integration:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize GitHub and pick `YinanZhaoXometry/synapse`.
3. Build settings — post-restructure values (pnpm-honest: the only lockfile in `frontend/` is `pnpm-lock.yaml`, so Pages installs with pnpm):
   - **Root directory: `frontend`**
   - Framework preset: **None** (the presets assume npm scripts; the fields below are the contract)
   - Build command: `pnpm run build` (package.json's `build` script is `vite build`; the script form doesn't rely on the bare `vite` binary resolving on the Pages build image)
   - Build output directory: `dist` (i.e. `frontend/dist` relative to the repo)
   - Environment variables: none
   - Node version: Pages default (vite 5 needs Node ≥ 18; leave default unless the build log says otherwise — the dev pin is `frontend/.nvmrc` = 24.22)
4. **Save and Deploy.** First deployment gives a `*.pages.dev` https URL — that is the shareable live-demo URL (custom domain optional, not required).
5. After it's green, verify: open the URL in a fresh browser profile → onboarding entry state loads; hard-refresh a deep route → app renders (no 404).

## Rollback

Pages keeps every deployment: dashboard → the Pages project → **Deployments** → pick the last-good deployment → **…** menu → **Rollback to this deployment**. Instant, no rebuild.

## Redeploying (every later epic)

Auto-deploy is on `main`: merge/push to `main` → Pages builds and publishes automatically. No manual step. (Check the project's **Deployments** tab if a push doesn't go live.)

## Jobs / Solid Queue (epic P2-7)

- The api boots its **own job supervisor in-process** (Solid Queue via puma's `plugin :solid_queue`): set `SOLID_QUEUE_IN_PUMA=1` on the web service and there is no worker process to deploy. Do NOT run `bin/jobs` standalone — the posture is one process (AD-19).
- **`DATABASE_URL` must point at Neon's DIRECT (non-pooled) connection string** for the service that boots the supervisor — Solid Queue's polling dislikes Neon's transaction-mode pooling and will stall or drop work behind it (AD-19; the pooled accelerator URL is fine for anything that does not poll).
- One recurring task ships (`due_scan`, every 10 minutes, `config/recurring.yml`). It is polling while the process is awake — harmless for Neon hours; the thing that drains Neon is keep-alive pinging to defeat cold starts, which the app forbids and specs guard (`spec/config/no_keep_alive_spec.rb`). Let the service sleep on Render's free tier.

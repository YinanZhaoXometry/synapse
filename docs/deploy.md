# Deployment — Cloudflare Pages (AD-11, FR-35)

Phase 1 ships as a static SPA. **AD-11 (2026-11-03):** `vite build` → static bundle → **Cloudflare Pages**, SPA-fallback rewrite to `index.html`, auto-deploy from `main`. No env vars, no server, no warm-up (NFR-6). The Phase-2 backend envelope (Render/Neon/R2) is AD-20 and does not apply to the web app. Since the monorepo restructure (AD-17) the SPA lives in **`frontend/`** — the Pages project's **Root directory is `frontend`** (deployment status below).

## Deployment status (2026-11-03)

**The owner has not configured Cloudflare Pages yet** — there is no legacy project to migrate and no re-point step. The earlier plan ("configure this week against the old layout, flip Root directory after the restructure merges" — Q3=b) is **void**: when deploying, do the fresh setup below directly with the post-restructure values (**Root directory `frontend`**, `pnpm run build`, output `dist`), and auto-deploy from `main` just works.

## Repo-side (already in place)

- `frontend/public/_redirects` — explicit SPA fallback (`/*  /index.html  200`). Vite copies `public/*` into `dist/` verbatim, so the file lands at the build-output root where Pages reads it. It pins the SPA behavior: hard refreshes on deep routes (`/plans`, `/read/<id>`, …) serve `index.html`. Pages would also auto-detect the SPA and serve `index.html` for non-asset paths when no top-level `404.html` ships (our dist has none) — so treat this file as belt-and-braces: it makes the fallback explicit rather than relying on Pages' auto-detection.
- Build (local truth): from `frontend/`, `node_modules/.bin/vite build` (pnpm layout — never `npm`/`npx` locally). Output dir: `dist` (vite default, no override in `frontend/vite.config.ts`) — relative to the Pages **Root directory**, i.e. the published artifact is `frontend/dist`. The `node_modules/.bin` rule is for this checkout's local dev only — the Pages build image (below) is a normal environment.
- **Env vars — changed at the Apollo cutover (epic P2-8 T1, 2026-11-04):** the app is no longer client-only — it calls the api (`/graphql` + the SSE surface `/api/stream`). The build-time `VITE_API_URL` env var sets the api base for the generated bundle (default: relative `/graphql`, correct ONLY behind a proxy that reaches the api — the Vite dev server proxies it in dev). A deployed Pages build MUST set `VITE_API_URL` to the api's public URL (T6's envelope pins the value; CORS_ORIGIN on the api must include the Pages origin — see `backend/config/initializers/cors.rb`). Ticket 06 owns the full deployed-envelope rewrite of this section; until then this line supersedes the old "no env vars, client-only" guidance.
- UI preference keys (`synapse-*`, `synapse-token`) remain local; study data lives on the api (the legacy `synapse-db:v1` document is rollback substrate, never written client-side anymore).

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
- **`DATABASE_URL` must point at Neon's DIRECT (non-pooled) connection string** — the same process serves web requests AND polls the queue, so the pooled accelerator URL cannot carry it (Solid Queue's polling dislikes transaction-mode pooling and will stall or drop work behind it, AD-19). Every connection of this one process goes direct.
- **Size the pool for web + queue in one process**: worker threads (`config/queue.yml`) + puma's web threads (`RAILS_MAX_THREADS`) + the dispatcher share one ActiveRecord pool — set `RAILS_MAX_THREADS` ≥ web threads + worker threads + 1 (with the shipped defaults: ≥ 5; the worker runs 1 thread). An undersized pool surfaces as `ActiveRecord::ConnectionTimeoutError` exactly when the 10-minute scan overlaps request traffic.
- Polling: the dispatcher/worker poll at `SOLID_QUEUE_POLLING_INTERVAL` seconds (default 10 — job latency is irrelevant for a 10-minute scan, and a 1-second idle poll would keep Neon compute awake through Render's idle windows). This polling stops when the process sleeps — it is NOT a keep-alive; the thing that drains Neon is pinging to defeat cold starts, which the app forbids and specs guard (`spec/config/no_keep_alive_spec.rb`). Let the service sleep on Render's free tier.
- One recurring task ships (`due_scan`, every 10 minutes, `config/recurring.yml`).

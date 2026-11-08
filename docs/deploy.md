# Deployment — the two-stack envelope (AD-20)

Phase 1 shipped as a static SPA (AD-11). Since the Apollo cutover (epic P2-8) the product is **two stacks**, and this is the full envelope (AD-20, 2026-11-03):

| Layer | Vendor | What runs there |
| --- | --- | --- |
| web | **Cloudflare Pages** | the static SPA (`frontend/` build) — AD-11 shape modernized 2026-11-08: SPA fallback via `frontend/wrangler.jsonc`'s `not_found_handling: "single-page-application"` (Cloudflare's unified Workers-assets pipeline — the classic `_redirects` catch-all is rejected as an infinite loop there), auto-deploy from `main` |
| api | **Render** (docker, ONE web service) | the Rails api — `POST /graphql` + `GET /api/stream` (SSE) + `GET /up` (health); **Solid Queue in-process** (AD-19, no worker service) |
| DB | **Neon** | Postgres 17 — **direct (non-pooled)** connection URL (AD-19) |
| blobs | **Cloudflare R2** | material files via ActiveStorage (AD-13; presigned direct PUT/GET, bytes never touch the api) |

Local parity is `just up` (compose: postgres 17 + api + Vite + minio as the R2 stand-in) — same shape, weaker credentials.

**Envelope posture, verbatim from AD-20:** *Free tier, no keep-alive*: idle spin-down is accepted (~1 min cold start: Render wake + Neon autosuspend resume) outside graded windows; **before a graded demo, upgrade Render + Neon for the demo window** (wake the stack once pre-demo). NFR-6 holds because everything before the login wall is static on Cloudflare and the demo account is pre-seeded. **Cutover rollback** = redeploy the last pre-cutover commit on Cloudflare Pages; the anonymous static build resumes from the still-present `synapse-db:v1` (import never deletes it); server-side work after cutover is abandoned, not merged back.

**Status (2026-11-04, epic P2-8 T6):** every repo-side artifact is committed (next section). **Neither live stack is provisioned yet** — the Render/Neon/R2/Pages accounts are owner-side; all live execution steps below are marked **[owner]** and none has been executed. Nothing in this doc is faked: unchecked boxes mean "not yet done".

**Convention:** steps marked **[owner]** execute in vendor dashboards/terminals by the owner. Repo-side prep (this file, `render.yaml`, `backend/Dockerfile`, `backend/.env.example`) is already done and gate-verified.

---

## 1. Repo-side substrate (committed — no owner action)

- `frontend/wrangler.jsonc` — the SPA fallback (2026-11-08): `not_found_handling: "single-page-application"` over the `dist/` assets — AD-11's deep-route-fallback semantics on the unified Workers-assets pipeline. Replaced `frontend/public/_redirects` (`/* /index.html 200`), which the pipeline's stricter validator rejects as an infinite loop (workers-sdk#11824). The `name` must stay `synapse` — matching the dashboard-created script — so `wrangler deploy` versions the existing worker.
- `backend/Dockerfile` — the production image (self-contained: gems baked, `RAILS_ENV=production`, no volume mounts — the Render analogue of `.dockerdev/Dockerfile.dev`, which stays dev-only). Boot command: `rails db:prepare db:seed` then `exec puma -C config/puma.rb` (idempotent every boot; see §5 and §8).
- `backend/.dockerignore` — keeps secrets (`.env*`) and local state (`log/`, `tmp/`, `vendor/bundle`, `.dockerdev`) out of the build context — docker COPY does not read `.gitignore`.
- `render.yaml` (repo root) — the Render Blueprint: one docker web service, `healthCheckPath: /up`, `plan: free`, every ENV var of §3 wired (`generateValue` for random secrets, `sync: false` for owner-pasted values, documented comments for the banned tunables).
- `backend/.env.example` — the full ENV contract with per-var comments (the textual source of truth for §3).
- `frontend/src/apollo/client.ts` + `frontend/src/ai/sse-client.ts` — read `VITE_API_URL` at build time (§4).

### Local AI end-to-end (dev-only, no owner accounts needed)

The provider key is a **local secret**: put it in `backend/.env`
(gitignored — never commit it). The Rails process loads that file itself in
development (dotenv-rails — the qc-center-api posture, 2026-11-06 owner
decision), so the plain single-file stack carries live AI config — no
compose override, no two-file invocation; bare `just up` suffices:

```bash
cat > backend/.env <<'ENV'
AI_API_KEY=<your OpenAI-compatible API key>
ENV

just up
docker compose -f backend/.dockerdev/compose.yaml exec backend \
  bundle exec rake ai:probe   # expect: "ai:probe OK"
```
(compose-injected ENV always wins over .env — dotenv never overwrites
existing variables — so the infra defaults in compose.yaml are unaffected.)

Verified locally 2026-11-05 (proposal stream, quiz generation, open-answer
grading, evidence → server scores, flashcard ratings — see the epic tracker's
smoke record). **The key carries a low concurrency limit**: one in-flight
provider request at a time — overlapping requests queue until the 120s
`AI_TIMEOUT_SECONDS` timeout surfaces as an honest `INTERNAL` (the UI
releases the question back to answering with the draft kept).

## 2. One-time provisioning ([owner]) — in this order

Pages comes **last** because its only env var needs the Render api URL.

### 2.1 Neon — Postgres 17

- [ ] **[owner]** Create a Neon account + project (Postgres **17**; pick the region nearest the demo audience — pair it with the Render region choice in §2.3).
- [ ] **[owner]** Copy the connection string **with the "Pooled connection" toggle OFF** — the hostname must NOT contain `-pooler` (AD-19: this URL also carries Solid Queue's polling; transaction-mode pooling stalls it). Append `?sslmode=require` if not already present. This is `DATABASE_URL` (§3).
- [ ] **[owner]** Note the branch/database name; the api's boot command creates the schema itself (`db:prepare`) — **no manual SQL to run**.

### 2.2 Cloudflare R2 — blob storage

- [ ] **[owner]** Create an R2 bucket (e.g. `synapse-materials`).
- [ ] **[owner]** Create an R2 **API token** scoped to the bucket (Object Read & Write) → yields `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`; the account S3 endpoint (`https://<account>.r2.cloudflarestorage.com`) is `R2_ENDPOINT`, the bucket name is `R2_BUCKET`.
- [ ] **[owner]** Add a CORS rule on the bucket allowing `PUT` from the Pages origin (the browser PUTs presigned uploads directly to R2 — epic P2-6 ticket 03 provisioning item; without it the re-attach step of the import fails in the browser).

### 2.3 Render — the api

- [ ] **[owner]** Render dashboard → **New → Blueprint** → connect the repo → Render reads `render.yaml`.
- [ ] **[owner]** Paste the `sync: false` values (§3 table): `DATABASE_URL` (Neon **direct** URL), `CORS_ORIGIN` (the Pages origin — §6; if Pages doesn't exist yet, use the planned `https://<project>.pages.dev` and correct it after §2.4), `DEMO_EMAIL`/`DEMO_PASSWORD`, the four `R2_*`, `AI_API_KEY`. `JWT_SECRET`/`SECRET_KEY_BASE` are generated on first apply — leave them.
- [ ] **[owner]** Verify `AI_API_KEY`'s terms are the owner's OQ-4 gate outcome; run the one manual live probe after first deploy: Render Shell → `bin/rails ai:probe` (never in CI).
- [ ] **[owner]** Deploy → watch it go green. First boot auto-migrates + seeds the demo account (§5). Health: the service answers `GET /up` with 200.
- [ ] **[owner]** Record the service URL (`https://<service>.onrender.com`) — it feeds §2.4's `VITE_API_URL`.

### 2.4 Cloudflare Pages — the web

Wrangler is not used — the project is created once via git integration:

- [ ] **[owner]** Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git** → authorize GitHub, pick the Synapse repo.
- [ ] **[owner]** Build settings (npm-honest: the only lockfile is `frontend/package-lock.json`):
  - **Root directory: `frontend`**
  - Framework preset: **None** (the fields below are the contract)
  - Build command: `npm run build` (the `build` script is `vite build`)
  - Build output directory: `dist` (i.e. `frontend/dist` relative to the repo)
  - **Environment variables (Production):** `VITE_API_URL` = `https://<service>.onrender.com/graphql` — **must end in `/graphql`**: `client.ts` uses it verbatim as the GraphQL URI and `sse-client.ts` derives the SSE endpoint by replacing that suffix with `/api/stream`. A wrong value fails loudly (login/network errors), not silently.
  - Node version: Pages default (vite 5 needs Node ≥ 18; the dev pin is `frontend/.nvmrc` = 24.22).
- [ ] **[owner]** **Save and Deploy** → the `*.pages.dev` URL is the live-demo URL (custom domain optional).
- [ ] **[owner]** If `CORS_ORIGIN` was set to a guessed origin in §2.3: set it to the real Pages origin and redeploy the api (§6 explains why a mismatch is fatal-ish).

### 2.5 Live-stack smoke (ticket ACs — execute once, record the date)

- [ ] **[owner]** `curl -s -X POST https://<service>.onrender.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ health }"}'` → 200 with a `data.health` payload.
- [ ] **[owner]** From the Pages origin: login with the demo account (§5) succeeds; one real plan round-trip (create → list) over HTTPS.
- [ ] **[owner]** One Companion stream runs (SSE through `/api/stream`; a dropped stream restarts and shows the cap-counted notice).
- [ ] **[owner]** CORS probe (§6) passes: the Pages origin is allowed, a foreign origin is refused.
- [ ] **[owner]** Cold start observed + timed once (~1 min posture, §7).

## 3. ENV inventory (complete)

Backend reads ENV only (AD-12; source of truth: `backend/.env.example` + grep `ENV[` in `backend/app` + `backend/config`). Web reads exactly one build-time var.

### Web (Cloudflare Pages, build-time)

| Name | Required | Value |
| --- | --- | --- |
| `VITE_API_URL` | yes | `https://<service>.onrender.com/graphql` (must end in `/graphql`; relative `/graphql` default is dev-only — the Vite proxy) |

### Api (Render) — fixed by `render.yaml`

| Name | Value | Why |
| --- | --- | --- |
| `RAILS_ENV` | `production` | Rails runtime (also baked into the image) |
| `SOLID_QUEUE_IN_PUMA` | `1` | boots the Solid Queue supervisor inside puma (AD-19); unset = the recurring due_scan silently never runs |
| `JWT_SECRET` | generated once | HS256 session-token signing (`Accounts::TokenCodec`, AD-15); rotating invalidates every token |
| `SECRET_KEY_BASE` | generated once | Rails secrets base (Rails 7.1+ reads the ENV before credentials; no `master.key` in this repo) |
| `PORT` | Render-injected | bound by `config/puma.rb` — never set it |

### Api (Render) — owner-pasted (`sync: false`)

| Name | Secret | Value contract |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **direct** URL (no `-pooler`), `sslmode=require` (AD-19) |
| `CORS_ORIGIN` | no | the Pages origin, exactly one (§6) |
| `DEMO_EMAIL` | no | demo account email (§5); downcased on create |
| `DEMO_PASSWORD` | yes | ≥ 8 chars (register-command parity); production seed fails fast when blank |
| `R2_ENDPOINT` | no | `https://<account>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | no | the materials bucket |
| `R2_ACCESS_KEY_ID` | yes | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | yes | R2 API token secret |
| `AI_API_KEY` | yes | OpenAI-compatible API key (AD-16); **required in production — boot fail-fast** |

### Api (Render) — optional tunables (code defaults; unset unless there is a named reason)

| Name | Default | Read by |
| --- | --- | --- |
| `AI_BASE_URL` | built-in code default (OpenAI-compatible endpoint) | `Ai::Provider` (AD-16; provider swap is config, not code) |
| `AI_MODEL` | built-in code default (model id) | `Ai::Provider` |
| `AI_TIMEOUT_SECONDS` | `120` | `Ai::Provider` |
| `AI_DAILY_CALL_CAP` | `50` | `Ai::DailyCap` (FR-34; counts stream restarts too) |
| `AI_CONTEXT_BUDGET_TOKENS` | `8000` | `Ai::ContextAssembler` |
| `AI_STREAM_TICKET_TTL_SECONDS` | `60` | stream ticket TTL (AD-16) |
| `LOGIN_RATE_LIMIT_THRESHOLD` | `10` | `Accounts::LoginRateLimiter` |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `60` | `Accounts::LoginRateLimiter` |
| `SOLID_QUEUE_POLLING_INTERVAL` | `10` (s) | `config/queue.yml` — **do not lower**: it keeps Neon awake through idle windows (AD-19) |
| `JOB_CONCURRENCY` | `1` | `config/queue.yml` worker processes |
| `RAILS_LOG_LEVEL` | `info` | `production.rb` |

### Deliberately NOT set (read the trap before touching)

| Name | Trap |
| --- | --- |
| `RAILS_MAX_THREADS` | moves BOTH sides of the pool arithmetic: puma web threads AND the ActiveRecord pool size (`database.yml` reads the same var). Shipped defaults (web 3 + queue worker 1 + dispatcher 1 vs pool default 5) fit exactly; setting it can strand the queue's threads (`ConnectionTimeoutError` under scan + request overlap). Leave unset. |
| `WEB_CONCURRENCY` | one puma worker is the free-tier/single-instance posture; more workers duplicate the queue supervisor's polling. |
| `BACKEND_DATABASE_PASSWORD` | `database.yml`'s non-URL fallback — the envelope always sets `DATABASE_URL`, so this never applies. |
| `CI` | test-harness signal only (`test.rb`); never in the deployed env. |

## 4. What deploys when

- **Pages:** auto-deploy on push to `main` (AD-11) — build-time `VITE_API_URL` means a changed api URL needs a Pages **rebuild**, not a runtime change.
- **Render:** `autoDeploy: true` on `main` via the blueprint — every `main` push rebuilds the docker image and redeploys. Boot re-runs `db:prepare db:seed` (idempotent). Free-tier note: the deploy itself wakes the service.
- **Schema changes:** land as Rails migrations on `main`; the api's next boot migrates Neon. No manual migration step exists in this envelope.

## 5. The demo account (AD-15)

- Seeded **automatically on every api boot** (Dockerfile CMD: `db:seed` → `DemoSeed`, idempotent: stable-uuid upserts, rerun-safe; re-keys an existing demo row's password to the current `DEMO_PASSWORD`). Credentials come from `DEMO_EMAIL`/`DEMO_PASSWORD` — production **fails fast at boot** when either is blank.
- Manual rerun if ever needed: Render Shell → `bin/rails db:seed`.
- The seed data is deliberately a small shape-stub (one private plan + two nodes — `app/lib/demo_seed.rb`); real demo content is seeded closer to the graded window per AD-20, by the owner, via the product (or an extension of the seed — an epic-level decision, not a deploy step).

## 6. CORS — exactly the web origin (ticket AC)

`backend/config/initializers/cors.rb` reads `CORS_ORIGIN` **once at boot** and allowlists the listed origins for `/graphql` (POST) and `/api/stream` (GET). Blank = no cross-origin at all (the safe pre-cutover default). Set it to the Pages origin **and nothing else** — no `localhost`, no trailing slash, exact scheme+host (a Pages preview origin `*.pages.dev` is NOT covered by the production origin; previews calling the production api fail by design — the api is single-tenant demo infrastructure).

**Probe (run after any `CORS_ORIGIN` change):**

```bash
# 1) the web origin must be allowed:
curl -s -i -X OPTIONS https://<service>.onrender.com/graphql \
  -H "Origin: https://<project>.pages.dev" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control
#    → expect `Access-Control-Allow-Origin: https://<project>.pages.dev`

# 2) a foreign origin must FAIL the same probe:
curl -s -i -X OPTIONS https://<service>.onrender.com/graphql \
  -H "Origin: https://foreign.example" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control
#    → expect NO `Access-Control-Allow-Origin` header (Rack::Cors never answers)

# 3) the SSE surface under the same allowlist:
curl -s -i -X OPTIONS https://<service>.onrender.com/api/stream \
  -H "Origin: https://foreign.example" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
#    → expect NO allow header
```

## 7. Cold start + the keep-alive ban (AD-19/AD-20)

- Free tier: the Render service spins down after ~15 idle minutes; Neon autosuspends its compute after ~5 idle minutes. First request after idle pays **~1 minute** (Render wake + Neon resume). Accepted posture — plan demo traffic behind an initial wake.
- **Never add a keep-alive** (uptime pinger, cron ping, self-ping): pinging defeats the sleep and the queue's polling then keeps Neon awake too — draining Neon's ~191 free compute hours in ~8 days (AD-19). Lexically guarded by `backend/spec/config/no_keep_alive_spec.rb` (spin-loop shapes in app/config/lib fail the suite). The queue's 10-second polling is **not** a keep-alive: it stops when the process sleeps.
- Correct-on-wake: due-ness (re-queue scan) recomputes from source timestamps on wake — nothing accumulates while asleep (AD-19).

## 8. Pre-demo paid-upgrade window (AD-20)

Before every **graded demo window**: upgrade both paid services for the window, wake once, downgrade after.

1. **[owner]** Render dashboard → `synapse-api` → **Upgrade** to Starter (or higher) — eliminates spin-down for the window (paid instances never sleep).
2. **[owner]** Neon console → project → **Scale** to a non-free plan (Launch tier) — removes autosuspend for the window.
3. **[owner]** Wake + verify once pre-demo: `curl https://<service>.onrender.com/up` → 200; open the app, log in as the demo account, run one Companion stream.
4. **[owner]** After the window: downgrade both back to free tiers. Cost posture: upgrades are window-scoped on purpose (AD-20) — do not leave them on.
5. **[owner]** If a demo must run on free tier instead: wake the stack once minutes before (step 3's curl), accept the ~1 min cold start on the first real request, and expect a second resume if the demo idles past Neon's autosuspend window.

## 9. Rollback rehearsal runbook (AD-20 — one page)

**The rule, verbatim AD-20:** cutover rollback = redeploy the last pre-cutover commit on Cloudflare Pages; the anonymous static build resumes from the still-present `synapse-db:v1` (the import never deletes it); server-side work after cutover is abandoned, not merged back.

**The pointer:** the last pre-cutover commit on `main` is

```
373e138 docs(p2-5): epic close-out — shipped, two-axis review clean, 751/751; backend/AGENTS.md contract refreshed (the AI surface is live)
```

(confirm with `git log --oneline -1 373e138` from any checkout of the repo; `main` currently points at it. If a later pre-cutover commit becomes the true last one before a cutover merge, this runbook's pointer updates to that SHA in the same change that merges the cutover.)

### Phase A — rehearsal prep (repo-side, done)

- This runbook exists; the verification checklist below is owner-executable as-is.
- The legacy document's durability is enforced in code: `synapse-db:v1` is read by the first-login import only, never written/deleted client-side post-cutover (grep-guarded to `src/lib/local-document.ts`).

### Phase B — pre-cutover baseline ([owner], once Pages is live and BEFORE the cutover reaches `main`)

- [ ] **[owner]** On the live static build (Pages, built from `main` = pre-cutover), use the app anonymously once: create/open a plan. DevTools → Application → Local Storage → confirm the `synapse-db:v1` key exists and holds that data. (This guarantees the rollback target has state to resume from.)
- [ ] **[owner]** Pages dashboard → project → **Deployments**: identify the deployment built from `373e138` (the list shows each deployment's commit). This is the rollback target; leave it in place (Pages keeps every deployment — do not delete old ones).

### Phase C — after the cutover is live ([owner])

- [ ] **[owner]** Log in on the cutover build, run the first-login import (or skip it), confirm plans/tasks render from the api.
- [ ] **[owner]** Re-check Local Storage: `synapse-db:v1` **still present** (the import reads it and must not delete it) — this is the rollback substrate proof.

### Phase D — the rollback itself ([owner])

1. Pages dashboard → project → **Deployments** → the `373e138` deployment → **…** menu → **Rollback to this deployment**. Instant (serves the stored build artifact — no rebuild, no env change). `VITE_API_URL` in that artifact predates the api URL wiring (client-only bundle) — nothing calls the api.
2. Verify (the checklist):
   - [ ] **[owner]** The site serves the anonymous build: no login wall, onboarding/Plans Home as pre-cutover.
   - [ ] **[owner]** **Fresh browser profile** (worst case — nothing cached): app loads, hard-refresh a deep route renders (AD-11 fallback intact).
   - [ ] **[owner]** A profile that had pre-cutover local data (or the profile from Phase B): plans/tasks/materials reappear **from `synapse-db:v1`** — the anonymous build resumed from the local document.
   - [ ] **[owner]** Local Storage after continued use: `synapse-db:v1` intact (never deleted), `synapse-token` residue (if any) inert — the static build predates it and never reads it.
   - [ ] **[owner]** `git log` check: no fix-forward commits pushed to `main` after the rollback. **Server-side work is abandoned, not merged back (AD-20):** repairs happen on the integration branch and re-ship as a new cutover deploy; nobody hot-patches the static build and nobody merges server-side experiments to `main` to "keep it warm".
   - [ ] **[owner]** Decide the api's fate out loud: leave Render + Neon running untouched (they serve no traffic once Pages rolls back) **or** suspend the Render service for the window. Either is AD-20-honest; do not half-migrate (e.g. do not re-point the static build at the api — it cannot, it is client-only).

### Phase E — re-cutover

- Fix forward on the integration branch → merge → Pages auto-deploys the new cutover build → repeat §2.5 smoke. The rollback deployment stays in Pages' history for next time.

## 10. Jobs / Solid Queue (AD-19)

- The api boots its **own job supervisor in-process** (Solid Queue via puma's `plugin :solid_queue`, gated on `SOLID_QUEUE_IN_PUMA` — set by `render.yaml`): no worker process, no worker service (Render has no free worker instance type; the queue's volume is one scan/10 min). Do NOT run `bin/jobs` standalone — the posture is one process (AD-19).
- **`DATABASE_URL` points at Neon's DIRECT (non-pooled) connection string** — the same process serves web requests AND polls the queue; the pooled accelerator URL cannot carry it (Solid Queue's polling dislikes transaction-mode pooling and will stall or drop work behind it). Every connection of this one process goes direct.
- **Pool arithmetic (why `RAILS_MAX_THREADS` stays unset):** worker threads (`config/queue.yml`, 1) + dispatcher (1) + puma's web threads (`RAILS_MAX_THREADS`, default 3) share ONE ActiveRecord pool sized by `database.yml`'s `max_connections` (fetch default 5) — 3 + 1 + 1 = 5 = the pool. An undersized pool surfaces as `ActiveRecord::ConnectionTimeoutError` exactly when the 10-minute scan overlaps request traffic; setting `RAILS_MAX_THREADS` moves both sides of the equation, so the shipped defaults are the contract.
- Polling: dispatcher/worker poll at `SOLID_QUEUE_POLLING_INTERVAL` seconds (default 10 — job latency is irrelevant for a 10-minute scan; a 1-second idle poll would keep Neon awake through Render's idle windows). This polling stops when the process sleeps — it is NOT a keep-alive; the app forbids keep-alives (`backend/spec/config/no_keep_alive_spec.rb`). Let the service sleep on the free tier (§7).
- One recurring task ships (`due_scan` every 10 minutes, `config/recurring.yml` → `Requeue::ScanJob`, the FR-24 re-queue scan; correct-on-wake).

## 11. Ops hardening — the demo-window checklist (epic-14 T3)

**The registry of record** (item / trigger / status / date for the four Deferred-table ops items — error visibility, Neon backups/PITR, password reset, Google OAuth) lives in [`../.scratch/phase-2/epic-14-small-tail/issues/03-ops-hardening-registry.md`](../.scratch/phase-2/epic-14-small-tail/issues/03-ops-hardening-registry.md)'s `## Comments` — maintained there, not duplicated here. Its disposition in one line: every item carries an external dependency (Render plan, Neon console, mail provider, Google console), so each is **trigger-recorded**, and the one item with a demo-window trigger (error visibility) is absorbed by the §8 posture below — the paid upgrade that kills spin-down also buys full dashboard log access for the window.

### Pre-demo checklist — run §8's steps, then verify:

- [ ] **[owner]** §8 steps 1–2: Render upgraded + Neon scaled for the window (this **is** the error-visibility answer: paid Render keeps full dashboard logs for the whole window — no log-drain setup needed).
- [ ] **[owner]** §8 step 3: wake + verify once pre-demo (`GET /up` → 200; demo login; one Companion stream).
- [ ] **[owner]** Error visibility DURING the window: watch the Render dashboard Logs after any anomaly; on a paid window, history is there when you need it. **If a demo must run on the free tier instead** (§8 step 5): Render keeps NO log history — capture failures live (copy/screenshot) as they happen; there is no after-the-fact log to consult.
- [ ] **[owner]** §8 steps 4–5: downgrade both services after the window; never leave the paid tier on (AD-20's window-scoped posture).

### Beyond the demo window — the before-real-users gates (not demo-blockers)

- **Neon backups/PITR** and **password reset (mail provider)** trigger when real users arrive beyond the demo account — both are owner-provisioned vendor features first, then small builds (registry rows 2–3).
- **Google OAuth** triggers only when a real user asks (registry row 4; email+password is the shipped auth path).
- Dates and unblock actions for all four: the ticket-03 registry table — update it there when an item moves.

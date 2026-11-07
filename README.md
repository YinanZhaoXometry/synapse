# Synapse

A bilingual (中文/English) AI-powered study web app — the COMP5241 (Software Engineering, PolyU) course project.

**The concept in one paragraph:** Synapse is plan-first. The system gives you a study plan — never content: you attach your own materials, and the plan's knowledge nodes organize what you study. Progress is measured by an evidence-based **Mastery Score** (0–100% per node/plan; 100% = exam/interview readiness) that only moves when you prove recall through a confirm quiz — marking a node is a claim, the quiz is the evidence. Quizzes (open-ended, choice, or mix) are generated strictly from your materials, in flow, by AI. A daily Today hub (今日学习) aggregates what's due; flashcards, mistakes, and an AI tutor for page-aware reading round out the loop.

## Repo structure

Monorepo (two apps, one contract, one entrypoint):

| Path        | What it is                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------- |
| `frontend/` | The Vite SPA — React 18 + TypeScript + shadcn/ui + Tailwind 3, Vitest tests                   |
| `backend/`  | The Rails 8.1 API-only service (GraphQL) — minimal bootable scaffold; see `backend/AGENTS.md` |
| `justfile`  | Root orchestrator: `just setup · up · migrate · dev · spec · e2e`                             |
| `docs/`     | Product brief + PRD, UX, architecture spine (AD-1…20), ADRs, agent handbooks                  |
| `.scratch/` | Local issue tracker (specs + tickets per epic)                                                |

The only cross-stack contract is the api-committed `backend/schema.graphql`, consumed by frontend's graphql-codegen.

## Development setup

### Prerequisites

| Tool           | Pinned version                   | Install                                                                                          | Why                                                                                                                                                            |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Desktop | current                          | [docker.com](https://www.docker.com/products/docker-desktop/) (colima also works)                | Runs the entire backend: Postgres 17 + MinIO + the Rails API are all containers                                                                                |
| nvm + Node     | 24.22 (`frontend/.nvmrc`)        | [nvm](https://github.com/nvm-sh/nvm#installation-and-updating), then `nvm install 24.22`         | Must be nvm-managed — the justfile resolves the pinned version from `~/.nvm/versions/node` and fails fast otherwise; a plain nodejs.org install won't be found. npm ships with Node — no separate package-manager install |
| just           | current                          | `brew install just` ([other platforms](https://just.systems/man/en/chapter_1_installation.html)) | Command runner for the root recipes                                                                                                                            |

**No Ruby needed.** Ruby 3.4.12 lives inside the backend dev image — the API runs in containers only; your local Ruby (or lack of it) is irrelevant.

**Windows:** use WSL2 (Ubuntu) and follow these steps inside it — the `just` recipes are bash scripts, so native Windows `just` can't run them. Docker Desktop's WSL2 backend supplies the containers.

### First run

**1. Bootstrap the toolchain** (frontend deps + MinIO image + backend dev image — a few minutes, once per machine):

```bash
just setup
```

**2. Configure the backend env** — copy the template, then fill in the one variable local dev actually needs:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

| Variable | Required? | Why |
| -------- | --------- | --- |
| `AI_API_KEY` | **yes — for live AI** | Your OpenAI-compatible API key. Without it the app still runs, but every AI surface (companion, quiz/flashcard generation, grading) returns errors. |
| `AI_BASE_URL` | no | Override to point at any OpenAI-compatible chat-completions endpoint; unset uses the built-in default. Swapping AI providers is config, never code. |
| `AI_MODEL` | no | The model id your endpoint serves; unset uses the built-in default. |
| `AI_TIMEOUT_SECONDS` | no | Per-call transport timeout in seconds (default `120`). |
| everything else | no — leave as-is for dev | `DATABASE_URL`, `JWT_SECRET`, `DEMO_EMAIL`/`DEMO_PASSWORD` are injected by the dev compose with working defaults; the rest of `.env.example` is commented-out tunables (login rate limiting, per-user AI caps `AI_DAILY_CALL_CAP` / `AI_CONTEXT_BUDGET_TOKENS`, stream-ticket TTL) or production-only (`R2_*`, `CORS_ORIGIN`, `SECRET_KEY_BASE` — see [docs/deploy.md](docs/deploy.md)). Per-variable comments live in `.env.example` itself. |

`backend/.env` is gitignored — **never commit it**. The Rails process loads it itself in development (dotenv-rails), so a plain `just up` carries live AI; compose-injected infrastructure values always win over the file, and the test suite never reads it (suites stay deterministic without a key).

**3. Start the stack:**

```bash
just up      # Postgres 17 + MinIO + API on http://localhost:3000 — returns once the health query answers
just dev     # Vite dev server on http://localhost:8080 (proxies /graphql to :3000)
```

If a `git pull` brought new backend migrations, run `just migrate` once — a running container does not pick them up on its own (migrations apply at container boot, not on file change), and an unmigrated database makes every API call return 500.

`just up` starts the containers **detached** — it returns to your prompt and the stack keeps running in the background; `just dev` is the only foreground process (your Ctrl-C / hot-reload loop). Restart Vite freely; the containers rarely need restarting. The SPA needs the API up, but they don't start together.

**4. Open http://localhost:8080** — first run shows the onboarding wizard, or log in with the seeded demo account **`demo@synapse.test` / `demo-password`**.

### Command cheat sheet — which `just` recipe, when

| Command | What it does | When to reach for it |
| ------- | ------------ | -------------------- |
| `just setup` | Installs frontend deps, builds the MinIO image, builds the backend dev image | **Once per machine** (fresh clone / new teammate). Everything else assumes it has run. |
| `just up` | Starts Postgres + MinIO + API detached; returns once the health query answers | **Start of every work session.** Safe to re-run while the stack is up — it just confirms health. |
| `just dev` | Vite dev server on :8080 with hot reload | **Start of every work session**, in its own terminal. The only foreground recipe — Ctrl-C stops Vite, the containers keep running. |
| `just migrate` | Applies pending migrations inside the running API container | **After a `git pull` that touched `backend/db/migrate/`** — a running container never picks up new migrations on its own; skipping this makes every API call return 500. Harmless no-op when there is nothing pending. The stack must be up. |
| `just spec` | Every gate, both stacks: codegen freshness · tsc · eslint · vitest · build · mastery-vector anti-drift · rubocop · rspec | **Before every push / PR.** CI runs the same gates — keep local green first. |
| `just e2e` | Playwright critical flows against a deterministic stub AI provider (no key needed); always restores the demo stack afterwards | **Before pushing** when you touched a critical flow (auth wall, plans, creation chat, reader, quiz→mastery, mistakes, hubs). |
| `just logs` | Follows the backend stack's logs | **Debugging.** "Why is the API failing" usually answers itself here first. |
| `just down` | Stops the stack (images and data volumes stay cached) | **End of the day**, or whenever you need ports 3000/9000 back. |
| `just minio-image` | Builds the pinned MinIO server + client from source (no registry carries it anymore) | Almost never by hand — `just setup` calls it. Only when a fresh machine's setup fails at that step. |
| `just` (bare) | Lists all recipes | Whenever the table above fades from memory. |

A typical session:

```bash
just up && just dev          # two terminals — dev is the foreground one
git pull && just migrate     # mid-session, when the pull brought migrations
just spec                    # before pushing
```

New-teammate shortcut: clone → `just setup` → `cp backend/.env.example backend/.env` (+ your AI key) → `just up` → `just dev` → open http://localhost:8080. After that, the table above is the whole story.

### Notes & gotchas

- **MinIO image bootstrap (fresh machines):** the pinned MinIO release is no longer on any registry — MinIO archived its community distribution in late 2025 (every registry channel is dead). `just setup` handles it: `just minio-image` builds the pinned server + client from source inside Docker, no host Go needed (same recipe as CI's e2e job).
- **File uploads** need a one-time `/etc/hosts` entry: `127.0.0.1 minio` (presigned upload URLs carry the container hostname `minio:9000`).
- **Verify the toolchain:** `just spec` runs every gate for both stacks (web: tsc · eslint · vitest · build · mastery-vector anti-drift; api: rubocop · rspec); `just e2e` runs the Playwright critical flows against a deterministic stub AI provider (no key needed).

Per-stack commands, the npm/nvm toolchain gotchas, the localStorage key inventory, and the architecture map live in [AGENTS.md](AGENTS.md) (the real project handbook). Backend conventions and stack pins: [backend/AGENTS.md](backend/AGENTS.md).

## Documentation

- [AGENTS.md](AGENTS.md) — commands, conventions, gotchas (start here; written for humans and agents alike)
- [GLOSSARY.md](GLOSSARY.md) — the engineering vocabulary (EvidenceRecord, Knowledge Node, Mastery Score, …)
- `docs/product/` — the approved brief and final PRD
- `docs/architecture/` — the architecture spine with stable decision IDs (AD-1…20)
- `docs/deploy.md` — Cloudflare Pages deployment (SPA, `_redirects` fallback)

# api/AGENTS.md — the api's architecture contract

Rules for everything under `api/`. Every rule cites its spine decision ID ([`docs/architecture/architecture-synapse/architecture-synapse.md`](../docs/architecture/architecture-synapse/architecture-synapse.md)) — tickets cite this doc; this doc cites the spine.

## What this is

A **minimal, bootable Rails 8.1 API-only scaffold** (epic-00 T02): GraphQL endpoint with one `health` query, `schema.graphql` dumped and committed as the cross-stack contract, colocated RSpec + RuboCop green, and `.dockerdev/compose.yaml` (postgres 17 + api) so `just up` boots a working api. **It intentionally has no business logic** — no commands, no models beyond `ApplicationRecord`, no auth, no AI, no jobs, no ActiveStorage. Later backend epics extend this scaffold and own those surfaces; they inherit the conventions below instead of re-deriving them.

## Stack pins

Pinned in `api/Gemfile` (exact patch pins per the spine stack table):

- Rails **8.1.4** (API-only), Ruby **3.4.12** (`api/.ruby-version`; the dev image is `ruby:3.4-slim` — your local Ruby is irrelevant)
- graphql-ruby **~> 2.5.26** (AD-12)
- puma **~> 7.2.1**, pg **~> 1.7.0**
- strong_migrations **~> 2.8.0** (AD-13)
- rspec-rails **~> 8.0.4** + factory_bot_rails **~> 6.5.1** (AD-10: specs colocated, commands and GraphQL operations tested directly)
- rubocop-rails-omakase (house style; `api/.rubocop.yml` inherits it)
- Postgres **17** everywhere — dev compose runs `postgres:17-alpine`; production is Neon Postgres 17 (AD-13 local/prod parity)

Not adopted from the reference (AD-12): settings gem (ENV only), Sidekiq/Redis (AD-19), OTel/Sentry/Yabeda, SCIM, multi-tenancy (single product; per-user scoping suffices — AD-13).

## Dev containers only (AD-17/AD-20)

The api runs **only inside its dev containers** — never bare `rails`/`bundle` on the host.

```bash
# Boot the stack (postgres 17 + api on port 3000) — or: just up
docker compose -f api/.dockerdev/compose.yaml up -d
# Gates — or: just spec
docker compose -f api/.dockerdev/compose.yaml run -e RAILS_ENV=test api bundle exec rspec
docker compose -f api/.dockerdev/compose.yaml run api bundle exec rubocop
# Done working on the api? Stack down.
docker compose -f api/.dockerdev/compose.yaml down
```

Notes, verified 2026-11-03: compose's `run` (no `--no-deps`) bootstraps the bundle (`bundle-cache` volume), runs `db:prepare`, and starts the db service, so the same form works from cold. **`RAILS_ENV=test` is required for rspec** — the service env defaults to `development` and request specs then 403 on HostAuthorization (development-only middleware). The compose entrypoint (`bin/docker-dev-entrypoint`) runs `bundle check || bundle install` + `db:prepare` before every `run` command, so even the DB-free-in-spirit specs need a reachable postgres today (Rails 8.1's `TestFixtures` pins a connection at example setup). Grep-level truth over stale claims: re-verify commands against this file's `compose.yaml` when touching tooling.

## GraphQL is the only web-facing surface (AD-12)

- One surface: `POST /graphql` → `GraphqlController#execute` (`config/routes.rb`). The AD-16 SSE endpoint (`/api/stream`) is the **only** sanctioned future non-GraphQL surface; presigned R2 URLs (AD-13) point at R2, never at the api.
- Depth/complexity limits + Dataloader batching stay on: `ApiSchema` mounts `GraphQL::Dataloader`, `max_query_string_tokens(5000)`, `validate_max_errors(100)`.
- **No Relay/node identification**: the install generator's node/connection scaffolding was removed; ids are plain UUID strings (below). Add Relay-style connections only when a list actually paginates.

## Command-layer-first (AD-12)

- Every use case is an **`ApplicationCommand`** class (dry-initializer + dry-monads `Result`): resolvers/mutations **parse args → authorize → call the command → map the Result**; jobs are thin wrappers that load a record and call a command.
- **Business logic never raises** — failures are `Failure` values. Exceptions are for infrastructure faults, not domain outcomes.
- The scaffold has no `app/commands/` yet — the first business epic creates it and this rule becomes load-bearing. Do not introduce a second service-object style next to it.

## Closed error enum ↔ web `AppError.code` 1:1 (AD-12 + AD-9)

- GraphQL error `extensions.code` is a **closed enum**, defined in `api/`:
  `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL`
- Web mirrors it as `AppError.code` (`web/src/data/errors.ts`), mapping **1:1 via `extensions.code`**. **Adding a code touches both sides in the same change** (AD-17's one-contract rule applied to errors).
- The api is **not user-facing** — its strings are error codes and English log lines, never rendered verbatim (AD-9). The web maps codes to `t()` keys and shows bilingual toasts; it never renders server strings.

## Ids: plain UUID strings (AD-12 / AD-15)

- Primary keys are **uuid columns; ids travel as plain UUID strings** — **no GlobalID**, no integer leakage.
- **Clients may supply ids on create** — this is what makes the first-login import idempotent (AD-15): whole-document upload, one transaction, one mutation; same-user id conflicts skip (retry-safe), an id owned by a *different* user is `VALIDATION_FAILED` with ownership verification (never silently link to another user's rows, FR-4).
- Every user-owned row is scoped by `user_id`, enforced in the command layer and asserted by a shared RSpec context (AD-13). The single sanctioned exception: the Square's public-plan read path — **structure only**, never Materials/Annotations/Mastery Scores (NFR-7).

## Pagination: plain lists until a list truly paginates (AD-12)

- Return plain lists by default. Relay connections are added only when a list actually paginates — the first candidate is evidence history. Don't preempt.

## The contract: `api/schema.graphql` (AD-17 / AD-18)

- `api/schema.graphql` is **the only cross-stack artifact** — committed, IDL-only, dumped with `bin/rails graphql:schema:dump` (inside the api container; the custom rake task in `lib/tasks/graphql.rake`). The dump is **idempotent**: `spec/graphql/schema_dump_spec.rb` re-dumps twice and asserts byte-identity with the committed file — keep it green.
- **A contract change touches both stacks in the same change**: api mutation/resolver + `schema.graphql` dump + web codegen regeneration land together (AD-17's no-shared-package rule; web consumes the schema via graphql-codegen).
- IDL-only is deliberate: graphql-ruby 2.5's introspection-JSON dump is broken against the json gem 3.x bundled with Ruby 3.4 (quirks_mode), and the web contract only needs the IDL.

## AI executes server-side only (AD-16)

- Provider keys live **only in api config** (ENV + `.env.example` — reference pattern). The provider sits behind an **OpenAI-compatible adapter, GLM first** (OQ-4); a provider swap is config, not code.
- All AI operations are GraphQL mutations (quiz/flashcard generation, grading, plan proposals) **except token streams**: one Rails **SSE endpoint** (`/api/stream`) emits them.
- **SSE ticket contract:** an opaque single-use secret, TTL ~60s, minted by a `createStreamTicket` mutation, bound to `current_user` + the pending operation, carried as a query param (log exposure accepted); the endpoint never retries auth (401 on a bad ticket) and sits under the same CORS origin allowlist as GraphQL. The client disables auto-reconnect — on drop it mints a fresh ticket and **restarts** the generation (deliberately counted against the cap; no server-side resume buffering v1).
- Stream event vocabulary: token, citation, rung, and terminal events carrying an error `code` from the closed enum. The **reply language (zh/en) is a request parameter** following the UI toggle.
- Cost cap (FR-34): 50 AI calls/user/day + ~8k-token context-in bound per request, enforced at the adapter boundary, values in server config.
- Generation is in-request (streamed) — **no AI jobs**.

## Jobs: Solid Queue posture, deferred (AD-19 + A9)

- When jobs arrive: **Solid Queue** (Rails 8 built-in, DB-backed on the same Postgres) runs **in-process with puma** — no separate worker service.
- The queue connects via Neon's **direct (non-pooled) connection URL** (its polling dislikes transaction-mode pooling).
- Recurring v1: the FR-24 re-queue due scan — correct-on-wake (due-ness recomputed from timestamps on wake).
- **No keep-alive loop** — cold starts are accepted per AD-20; keeping the service awake would drain Neon's free compute hours.
- **The gem is not installed.** It lands with the first epic that has a named job (FR-24 re-queue is the first candidate). No new background work without a named need.

## Data model & migrations (AD-13)

- ActiveRecord entities follow the spine ER, one model per entity, **no renames** at the entity-ownership cutover (AD-14 moves mastery computation to Ruby then; its rules are ADR-0001 verbatim, verified by golden vectors from the TS suite).
- **Postgres 17 parity**: Neon in production, `postgres:17-alpine` in the dev compose. Don't introduce a feature the prod database can't run.
- **strong_migrations is on** (`config/initializers/strong_migrations.rb`); plain schema migrations — no data-migration split, no logidze, no soft delete.
- **Material files** go to object storage via ActiveStorage → **Cloudflare R2** (Render disk is ephemeral): original file to R2, extracted sections/text to Postgres, parsing stays client-side (AD-7). Uploads presign via `createMaterialUpload` (GraphQL → R2 presigned PUT; the browser PUTs directly to R2; the ActiveStorage direct-uploads REST route is never mounted); downloads are short-lived presigned GETs exposed as GraphQL fields. **minio joins the dev compose in the storage epic** (A7) as the R2 stand-in — until then the scaffold has no ActiveStorage.

## Config: ENV only (AD-12 / AD-20)

- `DATABASE_URL`, `JWT_SECRET`, `PROVIDER_KEY`, `R2_*`, `CORS_ORIGIN`, cap values — documented in `api/.env.example`; the dev compose sets what the scaffold needs today (`DATABASE_URL`, `RAILS_ENV`). No settings gem.
- CORS stays origin-allowlisted to the web origin only (GraphQL + SSE). The generated `config/initializers/cors.rb` is still commented out — wire it when web first calls cross-origin (AD-20).

## Naming conventions (spine Consistency Conventions)

- Commands: `Context::VerbNounCommand` (e.g. `Plans::CreatePlanCommand`), one directory per context under `app/commands/`.
- Types/files PascalCase; GraphQL fields camelCase; entities/files match the ER names verbatim (no renames at cutover, AD-13/14).
- Specs colocated in `api/spec/`, `type:` metadata per rspec-rails; factories via factory_bot when the first model lands (AD-10).

## Deliberately absent (each arrives with the epic that owns it)

Auth/JWT (AD-15) · AI adapter + SSE (AD-16) · commands + domain models (AD-12/13) · ActiveStorage + R2/minio (AD-13, A7) · Solid Queue (AD-19, A9) · mastery computation (AD-14) · anything beyond the `health` query in the schema. If a ticket needs one of these, the epic owns installing it — don't smuggle infrastructure into an unrelated change.

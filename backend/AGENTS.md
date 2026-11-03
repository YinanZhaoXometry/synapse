# backend/AGENTS.md — the backend's architecture contract

Rules for everything under `backend/`. Every rule cites its spine decision ID ([`docs/architecture/architecture-synapse/architecture-synapse.md`](../docs/architecture/architecture-synapse/architecture-synapse.md)) — tickets cite this doc; this doc cites the spine.

## What this is

A **minimal, bootable Rails 8.1 API-only scaffold** (epic-00 T02): GraphQL endpoint with one `health` query, `schema.graphql` dumped and committed as the cross-stack contract, colocated RSpec + RuboCop green, and `.dockerdev/compose.yaml` (postgres 17 + backend) so `just up` boots a working api. **It intentionally has no business logic** — the only command code is the AD-12 command core (`ApplicationCommand` + the `System::PingCommand` exemplar, epic P2-1 ticket 01); the data layer is the AD-13 spine ER (users + the 13 spine entities as migrations/models, user-scoped, uuid PKs — epic P2-1 ticket 02) with its test seams landed (factory_bot factories for every entity + the shared user-scoping RSpec context — epic P2-1 ticket 03), and no auth, no AI, no jobs, no ActiveStorage, and no business commands yet. Later backend epics extend this scaffold and own those surfaces; they inherit the conventions below instead of re-deriving them.

## Stack pins

Pinned in `backend/Gemfile` (floor pins `~>` — `Gemfile.lock` holds the exact versions; rails pinned exact at scaffold per the spine stack table):

- Rails **8.1.4** (API-only), Ruby **3.4.12** (`backend/.ruby-version`; the dev image is `ruby:3.4.12-slim` — your local Ruby is irrelevant)
- graphql-ruby **~> 2.5.26** (AD-12)
- dry-initializer **~> 3.2** + dry-monads **~> 1.11** (AD-12 command core; runtime deps in the default group)
- puma **~> 7.2.1**, pg **~> 1.7.0**
- strong_migrations **~> 2.8.0** (AD-13)
- rspec-rails **~> 8.0.4** + factory_bot_rails **~> 6.5.1** (AD-10: specs colocated, commands and GraphQL operations tested directly)
- rubocop-rails-omakase (house style; `backend/.rubocop.yml` inherits it)
- Postgres **17** everywhere — dev compose runs `postgres:17-alpine`; production is Neon Postgres 17 (AD-13 local/prod parity)

Not adopted from the reference (AD-12): settings gem (ENV only), Sidekiq/Redis (AD-19), OTel/Sentry/Yabeda, SCIM, multi-tenancy (single product; per-user scoping suffices — AD-13).

## Dev containers only (AD-17/AD-20)

The api runs **only inside its dev containers** — never bare `rails`/`bundle` on the host.

```bash
# Boot the stack (postgres 17 + backend on port 3000) — or: just up
docker compose -f backend/.dockerdev/compose.yaml up -d
# Gates — or: just spec (rubocop first, matching the justfile/CI order)
docker compose -f backend/.dockerdev/compose.yaml run --no-deps --entrypoint "" -e RAILS_ENV=test backend sh -c 'bundle check || bundle install && bundle exec rubocop'
docker compose -f backend/.dockerdev/compose.yaml run -e RAILS_ENV=test -e DATABASE_URL=postgres://postgres:postgres@db:5432/backend_test backend sh -c 'bundle exec rspec'
# Done working on the api? Stack down.
docker compose -f backend/.dockerdev/compose.yaml down
```

Notes, verified 2026-11-04: the specs are **DB-backed** since epic P2-1 ticket 02 — the spine ER + model specs pin real rows, `spec/rails_helper.rb` sets `use_transactional_fixtures = true` (every example rolls back inside a transaction; `use_active_record` stays at its default — see the comment there for the rspec-rails 8 trap), and every rspec run therefore needs postgres: the compose `run` (no `--no-deps`) starts the db service, and the dev entrypoint bundle-installs and runs `db:prepare` before handing off. **Override `DATABASE_URL` to a test database** (`postgres://postgres:postgres@db:5432/backend_test`) on every rspec run — without it the entrypoint's `db:prepare` would prepare the development database instead, and the spec run would sit on it. RuboCop stays DB-free (`run --no-deps --entrypoint ""` + bundle guard). CI mirrors this: a `postgres:17-alpine` service container + `DATABASE_URL` + a `db:prepare` step before rspec. **`RAILS_ENV=test` is required for rspec** — the service env defaults to `development` and request specs then 403 on HostAuthorization (development-only middleware). Grep-level truth over stale claims: re-verify commands against this file's `compose.yaml` when touching tooling.

## GraphQL is the only web-facing surface (AD-12)

- One surface: `POST /graphql` → `GraphqlController#execute` (`config/routes.rb`). The AD-16 SSE endpoint (`/api/stream`) is the **only** sanctioned future non-GraphQL surface; presigned R2 URLs (AD-13) point at R2, never at the backend.
- Depth/complexity limits + Dataloader batching stay on: `ApiSchema` mounts `GraphQL::Dataloader`, `max_query_string_tokens(5000)`, `validate_max_errors(100)`.
- **No Relay/node identification**: the install generator's node/connection scaffolding was removed; ids are plain UUID strings (below). Add Relay-style connections only when a list actually paginates.

## Command-layer-first (AD-12)

- Every use case is an **`ApplicationCommand`** class (dry-initializer + dry-monads `Result`): resolvers/mutations **parse args → authorize → call the command → map the Result**; jobs are thin wrappers that load a record and call a command.
- **Business logic never raises** — failures are `Failure` values. Exceptions are for infrastructure faults, not domain outcomes.
- The core landed 2026-11-04 (epic P2-1 ticket 01): `app/commands/application_command.rb`. `Context::VerbNounCommand` subclasses declare dry-initializer `option`s, override the `#authorize` hook when needed (default allow; deny with `Failure(:UNAUTHORIZED, …)`), and implement `#call` returning a Result. `.call(**args)` wires authorize → call and **never raises**: an unexpected `StandardError` becomes a typed `Failure(:INTERNAL, context: { message: "unexpected <Class>: <msg>" })`. The deliberate exceptions (misuse fails fast at the seam instead of masquerading as a domain outcome): the `Failure(code, context)` factory raises `ApplicationErrors::InvalidCodeError` (an `ArgumentError`) for a code outside the closed enum, and construction misuse — an exception from `new(**args)` itself, e.g. a raising dry-initializer `default:` proc — propagates out of `.call` (the instance is built before the rescue region; only authorize/call are wrapped). `System::PingCommand` (`app/commands/system/`) is the pattern exemplar; its spec is the template for direct command testing (AD-10). Do not introduce a second service-object style next to it.

## Closed error enum ↔ web `AppError.code` 1:1 (AD-12 + AD-9)

- GraphQL error `extensions.code` is a **closed enum**, defined once in `backend/` as `ApplicationErrors::CODES` (`app/commands/application_errors.rb`; frozen symbols, this exact order):
  `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL`
- `ErrorPresenter` (`app/graphql/error_presenter.rb`) maps an unwrapped command failure (`result.failure`, an `ApplicationErrors::Failure` — `code` symbol + free-form `context` hash) into the error payload `{ message:, extensions: { code: "<CODE>" } }`; resolvers/mutations feed that to `GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions])`. `message` comes from `context[:message]` (an English log line, AD-9) and falls back to the code string; the rest of the context is never copied into the payload.
- Frontend mirrors it as `AppError.code` (`frontend/src/data/errors.ts`), mapping **1:1 via `extensions.code`**. **Adding a code touches both sides in the same change** (AD-17's one-contract rule applied to errors).
- The api is **not user-facing** — its strings are error codes and English log lines, never rendered verbatim (AD-9). The web maps codes to `t()` keys and shows bilingual toasts; it never renders server strings.

## Ids: plain UUID strings (AD-12 / AD-15)

- Primary keys are **uuid columns; ids travel as plain UUID strings** — **no GlobalID**, no integer leakage.
- **Clients may supply ids on create** — this is what makes the first-login import idempotent (AD-15): whole-document upload, one transaction, one mutation; same-user id conflicts skip (retry-safe), an id owned by a *different* user is `VALIDATION_FAILED` with ownership verification (never silently link to another user's rows, FR-4).
- Every user-owned row is scoped by `user_id`, enforced in the command layer and asserted by a shared RSpec context (AD-13). The single sanctioned exception: the Square's public-plan read path — **structure only**, never Materials/Annotations/Mastery Scores (NFR-7).

## Pagination: plain lists until a list truly paginates (AD-12)

- Return plain lists by default. Relay connections are added only when a list actually paginates — the first candidate is evidence history. Don't preempt.

## The contract: `backend/schema.graphql` (AD-17 / AD-18)

- `backend/schema.graphql` is **the only cross-stack artifact** — committed, IDL-only, dumped with `bin/rails graphql:schema:dump` (inside the api container; the custom rake task in `lib/tasks/graphql.rake`). The dump is **idempotent**: `spec/graphql/schema_dump_spec.rb` re-dumps twice and asserts byte-identity with the committed file — keep it green.
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

- ActiveRecord entities follow the spine ER, one model per entity, **no renames** at the entity-ownership cutover (AD-14 moves mastery computation to Ruby then; its rules are ADR-0001 verbatim, verified by golden vectors from the TS suite). **The ER landed 2026-11-04** (epic P2-1 ticket 02): users + 13 spine entities — uuid PKs (`gen_random_uuid()` server default, client-suppliable on create), `user_id` FK (indexed) on every user-owned row, enum-ish strings pinned by model `enum` + DB check constraints, field-level decisions in the ticket's `## Comments` (`.scratch/phase-2/epic-01-api-foundation/issues/02-er-migrations.md`).
- **User scoping has a standing test (AD-13 / FR-4) — one include away, or zero:** the shared examples `"user-scoped"` live in `spec/support/user_scoping.rb`, and `spec/models/user_scoping_spec.rb` is the roster keeper. It discovers every concrete model dynamically (`ApplicationRecord.descendants` after an eager load — the test env is lazy outside CI) and proves per model: the `User` has_many lists **only** the owner's rows, `find_by(id:)` on another user's row → nil, `.find(id:)` → `ActiveRecord::RecordNotFound`, and a same-user read succeeds. **Landing a new model needs no spec edit:** give it `belongs_to :user` + a `user_id` column + a `User` has_many named `model.name.underscore.pluralize` (the roster spec fails with an actionable message for any of the three), and a factory named after the model (`model.name.underscore`) — the roster picks it up. Model specs may also include it directly: `include_examples "user-scoped", described_class` (a second arg overrides the has_many name).
- **Factory rules (AD-10/AD-12):** factories live in `spec/factories/` (one file per entity, table-style plural filenames — landed 2026-11-04, epic P2-1 ticket 03). **Never pre-assign uuid ids** — the `gen_random_uuid()` server default fills them; a client-supplied id is an explicit test choice, not a factory default. Sequences only for uniqueness-bearing fields (`users.email`). Multi-association factories pass `user:` down so the whole graph shares one owner (`association :material, user: user`); the task↔node triangle does the insert dance from ticket 02's Comments (node/material with `task_id` null → create the task → back-fill `task_id` in `after(:create)`). **Overriding an association (`material:`/`node:`/`question:`/…) with a record of another user requires the consistent `user:` overrides across the whole graph** — a cross-owner triangle silently breaks the AD-13 model; the default-factory-graph guard spec (`spec/factories/study_tasks_spec.rb`) pins the single-owner invariant for the triangle.
- **strong_migrations is on** (`config/initializers/strong_migrations.rb`); plain schema migrations — no data-migration split, no logidze, no soft delete.
- **Material files** go to object storage via ActiveStorage → **Cloudflare R2** (Render disk is ephemeral): original file to R2, extracted sections/text to Postgres, parsing stays client-side (AD-7). Uploads presign via `createMaterialUpload` (GraphQL → R2 presigned PUT; the browser PUTs directly to R2; the ActiveStorage direct-uploads REST route is never mounted); downloads are short-lived presigned GETs exposed as GraphQL fields. **minio joins the dev compose in the storage epic** (A7) as the R2 stand-in — until then the scaffold has no ActiveStorage.

## Config: ENV only (AD-12 / AD-20)

- `DATABASE_URL`, `JWT_SECRET`, `PROVIDER_KEY`, `R2_*`, `CORS_ORIGIN`, cap values — documented in `backend/.env.example`; the dev compose sets what the scaffold needs today (`DATABASE_URL`, `RAILS_ENV`). No settings gem.
- CORS stays origin-allowlisted to the web origin only (GraphQL + SSE). The generated `config/initializers/cors.rb` is still commented out — wire it when web first calls cross-origin (AD-20).

## Naming conventions (spine Consistency Conventions)

- Commands: `Context::VerbNounCommand` (e.g. `Plans::CreatePlanCommand`), one directory per context under `app/commands/`.
- Types/files PascalCase; GraphQL fields camelCase; entities/files match the ER names verbatim (no renames at cutover, AD-13/14).
- Specs colocated in `backend/spec/`, `type:` metadata per rspec-rails; factories in `spec/factories/` and the shared user-scoping context in place (epic P2-1 ticket 03 — see "Data model & migrations" for the factory rules and the context's usage contract).

## Deliberately absent (each arrives with the epic that owns it)

Auth/JWT (AD-15) · AI adapter + SSE (AD-16) · business commands (the AD-12 command core exists; real commands arrive with their epics) · ActiveStorage + R2/minio (AD-13, A7) · Solid Queue (AD-19, A9) · mastery computation (AD-14) · anything beyond the `health` query in the schema. If a ticket needs one of these, the epic owns installing it — don't smuggle infrastructure into an unrelated change.

# 01: Credentials + JWT primitives (command level)

**What to build:** `has_secure_password` + bcrypt on User; JWT encode/decode helpers (`JWT_SECRET` ENV, ~24h TTL, `sub` = user uuid + `exp`); `Accounts::RegisterUserCommand` + `Accounts::LoginUserCommand` (email shape + password minimum; duplicate email → `VALIDATION_FAILED`; wrong credentials → `UNAUTHORIZED`); `.env.example` grows `JWT_SECRET`.

**Blocked by:** None (epic gate: epic-01 done).

**Status:** done

**Bound by:** AD-15 (bcrypt + stateless JWT ~24h, no refresh/denylist — accepted risk), AD-12 (commands never raise; closed error enum).

- [x] Register/login commands return Success(user, token) / typed Failures; tested directly per AD-10
- [x] Token round-trips via decode helper; expiry boundary tested
- [x] `.env.example` documents `JWT_SECRET`; compose wires it
- [x] RuboCop clean

## Comments

Built 2026-11-04 on `epic/p2-2-t01-credentials` (base `epic/p2-2-auth` @ `913be08`, final merge no-op). Gates: rspec **182 examples, 0 failures** (157 baseline + 25 new), rubocop **115 files, no offenses**, `schema.graphql` byte-identical (no GraphQL surface — ticket 02 owns the first schema movement).

**Gems (kickoff choice 1):** `bcrypt 3.1.22` + `jwt 3.3.0` — verified current stable on rubygems.org, floor-pinned `~>` in the runtime default group (same posture as dry-initializer/dry-monads); exact versions in `Gemfile.lock`. Dockerfile.dev already carried build-essential, so bcrypt's native ext compiled inside the dev image unchanged.

**Token codec — location + shape:** `app/lib/accounts/token_codec.rb` → `Accounts::TokenCodec`. Deliberately NOT under `app/commands/`: it is not a use case, and the contract keeps that tree for `ApplicationCommand` subclasses (no second service-object style); `app/lib/` is an autoload root with zero config and keeps the same `Accounts::` namespace as its commands. API:
- `encode(sub:, now: Time.current)` → token string. Claims `sub` (user uuid) + `exp` (now + `TTL = 24.hours`, truncated to integer seconds). `now` is injectable (specs pin expiry deterministically — no sleeps). HS256 forced.
- `decode(token)` → `Decoded` struct, **never raises**.
- encode with an absent/blank `JWT_SECRET` raises `MissingSecretError` — an infrastructure fault fails fast at the seam (inside a command it surfaces as the typed INTERNAL that `ApplicationCommand` already provides); decode with an absent secret is a typed `:invalid`, not a raise.

**Decode-failure taxonomy (what ticket 02 needs):** `Decoded { user_uuid:, error: }` with `ok?` ⇔ `error.nil?`. Exactly two failure reasons:
- `:expired` — signature verified but `exp <= now` (jwt gem raises `JWT::ExpiredSignature`).
- `:invalid` — everything else: malformed/garbage/empty token, bad signature (wrong/garbage secret), wrong algorithm, missing required claims (`required_claims: %w[sub exp]` — a well-signed token without either is `:invalid`), absent secret at decode time.
Ticket 02 maps both to `UNAUTHORIZED` at the GraphQL boundary while the distinction survives for log lines. All `JWT::*` decode errors are `DecodeError` subclasses, so the two rescues cover the whole surface (pinned by the taxonomy spec).

**Secret/TTL wiring (kickoff choice 6):** `JWT_SECRET` via ENV (AD-12, no settings gem). `backend/.env.example` documents it (rotate ⇒ every outstanding token dies — stateless, AD-15 accepted risk); `.dockerdev/compose.yaml` wires a fixed dev-only default `dev-only-insecure-secret-change-me` (fixed on purpose so minted tokens survive container restarts). Specs pin their own secret via an around-hook — CI needs no env change.

**Commands:** under `app/commands/accounts/` per `Context::VerbNounCommand`. Both return `Success(user:, token:)` as a plain keyword-hash payload (the `System::PingCommand` exemplar's shape; no value object needed). `user` is the full AR record — ticket 02 decides what the `User` GraphQL type exposes (password_digest must not be a field).
- `Accounts::RegisterUserCommand(email:, password:)`: downcase → `URI::MailTo::EMAIL_REGEXP` shape → `password.length >= MIN_PASSWORD_LENGTH (8)` → `User.exists?` pre-check → `User#save` (the model-level uniqueness validation is the second gate; `false` ⇒ same duplicate failure) → `rescue ActiveRecord::RecordNotUnique` backstop for the race between check and INSERT. Duplicate ⇒ `VALIDATION_FAILED` with `{ message:, field: :email }`; invalid shape ⇒ same code, `field: :email`; short password ⇒ `field: :password`.
- `Accounts::LoginUserCommand(email:, password:)`: `User.authenticate_by(downcased email, password:)` — returns nil for BOTH an unknown email and a wrong password, and runs a dummy bcrypt verification on the miss path (timing-levelled; user enumeration off the table). Either ⇒ `UNAUTHORIZED` `"invalid email or password"`, contexts byte-identical (pinned via Struct equality in the spec). Blank/nil inputs ⇒ the same `UNAUTHORIZED` (authenticate_by short-circuits on blank passwords; no ArgumentError escapes). **Rate limiting deliberately NOT here** — ticket 02 lands it at the mutation/command boundary (`Failure(:RATE_LIMITED)` is its own pinned choice).

**Model/factory:** User gained only `has_secure_password` (digesting + `authenticate`); all credential validation stays command-side per epic-01's minimal-model posture. `spec/factories/users.rb` now mints a real digest (`password { "synapse-test-password" }`; test env runs bcrypt at `MIN_COST` — free). Existing `password_digest: "digest"` direct-creations in model specs still pass.

**Tests (25 new):** `spec/lib/accounts/token_codec_spec.rb` ×10 (round-trip, TTL claim via the raw jwt gem as independent oracle, encode MissingSecretError, expiry boundary at TTL−1s ok / exactly TTL expired via `TimeHelpers`, taxonomy: malformed/empty/nil, wrong secret, missing claim, absent secret); `spec/commands/accounts/register_user_command_spec.rb` ×8 (happy, downcase, email shape ×3, password boundary 7/8, nil inputs, duplicate case-insensitive, context presence, RecordNotUnique backstop via stubbed `exists?`+`valid?`); `spec/commands/accounts/login_user_command_spec.rb` ×6 (happy + downcased lookup, wrong password, unknown email, indistinguishable halves, nil/blank inputs); `spec/models/user_spec.rb` ×1 (digest + authenticate).

**Review addendum (2026-11-04, P1-B — bcrypt MIN_COST claim resolved empirically):** the two-axis review disputed this ticket's "test env runs bcrypt at MIN_COST — free" claim (axis 1: no `BCrypt::Engine.cost`/`MIN_COST` config exists anywhere in the app, so tests digest at default cost 12; axis 2: Rails sets it for test automatically). Resolved in the test container with `rails runner` (RAILS_ENV=test): `ActiveModel::SecurePassword.min_cost` → **`true`**; `BCrypt::Engine::MIN_COST` → **4**; `BCrypt::Engine.cost` → **12**; a fresh `User.new(password: "x" * 12).password_digest` → **`$2a$04$…`** (cost segment `04`; `BCrypt::Password.new(digest).cost` → **4**). Axis 2 was right — the claim in the Model/factory paragraph above is accurate. Mechanism (cited so it stops looking like folklore): Rails' **activemodel railtie initializer** (`"active_model.secure_password"`) assigns `ActiveModel::SecurePassword.min_cost = Rails.env.test?` at boot, and `has_secure_password` digests at `MIN_COST` when that flag is true. Axis 1's observation was literally true but its conclusion was not: the app indeed configures no bcrypt cost anywhere — the mechanism is in the framework, not the app. No code change needed; `rails_helper` stays untouched. `spec/models/user_spec.rb` now pins the mechanism (min_cost true + digest cost == 4) so a future env/config change that silently re-costs the suite to 12 fails by name.

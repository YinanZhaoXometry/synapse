# 01: ApplicationCommand core + closed error enum + GraphQL error presenter

**What to build:** `app/commands/application_command.rb` — dry-initializer + dry-monads `Result`; commands never raise, failures are `Failure(code, context)` values; authorize → call → Result wiring on the base class. The closed error enum `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` as one constant + the presenter mapping a Failure into a GraphQL error payload with `extensions.code`. One trivial demo command proves the pattern at command level (RSpec calls it directly).

**Blocked by:** None (epic gate: epic-00 done).

**Status:** done

**Bound by:** AD-12 (command core, never raise, closed enum ↔ future `AppError.code` 1:1), AD-10 (commands tested directly).

- [x] `ApplicationCommand` base with dry-initializer + dry-monads; every `Failure` carries an enum code
- [x] Closed error enum as the single constant; presenter emits `extensions.code` payloads
- [x] Demo command: happy path returns Success, failure path returns a typed Failure — both asserted by direct RSpec
- [x] RuboCop clean; conventions (naming `Context::VerbNounCommand`, thin-resolver rule) documented in `backend/AGENTS.md` alongside the code

## Comments

For later tickets (02–03 and the first business epics):

- **Gems (floor pins `~>`; exact versions in `Gemfile.lock`):** dry-initializer **3.2.0**, dry-monads **1.11.0** (+ transitive dry-core 1.2.0). Runtime deps in the default Gemfile group, not dev/test. No dry-validation/dry-types (not in the spine stack table).
- **Base class — `app/commands/application_command.rb`:** `.call(**args)` = dry-initializer options → `#authorize` (public, overridable hook, default allow, returns a Result) → `#call` (returns a Result), wired as `authorize.bind { call }` so an authorize Failure short-circuits without running `call`. Never raise: unexpected `StandardError` from authorize/call → typed `Failure(:INTERNAL, context: { message: "unexpected <Class>: <msg>" })`. **The one deliberate exception** (refinement over the ticket's suggested shape): the `Failure(code, context)` factory (private, the only sanctioned Failure constructor inside commands — it shadows dry-monads' raw factory) raises `ApplicationErrors::InvalidCodeError` (subclass of `ArgumentError`) for a non-enum code, and `.call`'s rescue chain re-raises it — misuse fails fast at the seam instead of masquerading as a domain outcome.
- **Failure values:** `ApplicationErrors::Failure` — keyword struct (`code` enum symbol, `context` hash, nil context normalized to `{}`). Consume via `result.failure.code` / `.context`. Codes are **symbols** in Ruby; only the presenter stringifies.
- **Enum:** the single constant is `ApplicationErrors::CODES` in `app/commands/application_errors.rb` — frozen symbol array, exactly `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` in contract order (pinned by spec).
- **Presenter:** `ErrorPresenter` (top-level class, `app/graphql/error_presenter.rb`). Input: the **unwrapped** failure value (`result.failure`), not the monad. Output: plain hash with symbol keys — `{ message:, extensions: { code: "<CODE>" } }` (code stringified; a sweep spec pins this for all seven codes — the web `AppError.code` mirror). `message` = `context[:message]` (English log line, AD-9) falling back to the code string; the rest of the context is deliberately NOT copied into the payload. Resolvers/mutations feed it to `GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions])` when the GraphQL surface epic wires mutations.
- **Demo command:** `System::PingCommand` in `app/commands/system/ping_command.rb` (`option :message`, default `"pong"`; blank message → typed `VALIDATION_FAILED`). NOT in `schema.graphql` (health-only, byte-identical — `spec/graphql/schema_dump_spec.rb` green). Kept as the pattern exemplar referenced from `backend/AGENTS.md`; real commands land beside it, one directory per context.
- **Tests (15 new, all direct — no DB, no GraphQL):** `spec/commands/application_errors_spec.rb` (5), `spec/commands/application_command_spec.rb` (4 — happy path, authorize denial short-circuits, exception→INTERNAL, enum-guard escape through `.call`), `spec/commands/system/ping_command_spec.rb` (3), `spec/graphql/error_presenter_spec.rb` (3). Suite total 17 examples, green; rubocop clean (omakase; the `Failure` factory carries an inline `Naming/MethodName` disable — capitalized factories mirror dry-monads).

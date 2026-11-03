# 01: ApplicationCommand core + closed error enum + GraphQL error presenter

**What to build:** `app/commands/application_command.rb` — dry-initializer + dry-monads `Result`; commands never raise, failures are `Failure(code, context)` values; authorize → call → Result wiring on the base class. The closed error enum `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` as one constant + the presenter mapping a Failure into a GraphQL error payload with `extensions.code`. One trivial demo command proves the pattern at command level (RSpec calls it directly).

**Blocked by:** None (epic gate: epic-00 done).

**Status:** ready-for-agent

**Bound by:** AD-12 (command core, never raise, closed enum ↔ future `AppError.code` 1:1), AD-10 (commands tested directly).

- [ ] `ApplicationCommand` base with dry-initializer + dry-monads; every `Failure` carries an enum code
- [ ] Closed error enum as the single constant; presenter emits `extensions.code` payloads
- [ ] Demo command: happy path returns Success, failure path returns a typed Failure — both asserted by direct RSpec
- [ ] RuboCop clean; conventions (naming `Context::VerbNounCommand`, thin-resolver rule) documented in `backend/AGENTS.md` alongside the code

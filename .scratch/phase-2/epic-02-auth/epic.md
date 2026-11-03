# Epic 2 (Phase 2) — Accounts: email+password JWT, current_user context, demo seed

Status: done (2026-11-04 — branch epic/p2-2-auth @ 8cbfc47, CI green run 41706564212 after CI-red fix 41703745968, two-axis review 0P0/2P1/10P2 all fixed, merged to main same day)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane A · spine **AD-15** (bcrypt + JWT bearer, ~24h TTL, no refresh/denylist v1, demo seed, client-side logout), AD-12/13 (commands + scoping) · FR-30 (email+password half), FR-4 · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-users-credentials.md](issues/01-users-credentials.md) | — | bcrypt credentials, JWT encode/decode (~24h, `JWT_SECRET`), command-level login/register |
| 2 | [02-auth-context-mutations.md](issues/02-auth-context-mutations.md) | 01 | `register`/`login` mutations, GraphQL `current_user` context, login rate limit |
| 3 | [03-demo-account-seed.md](issues/03-demo-account-seed.md) | 01 | idempotent ENV-driven demo seed (demo user + shape-stub dataset) |

## Definition of done

Register/login answer over GraphQL with a bearer token the context resolves · `UNAUTHORIZED` on absent/invalid token · rate limit trips · demo seed rerun-safe · scoping context re-proven with a JWT-backed user · rubocop+rspec green · every ticket cites AD ids.

## Coordination notes

- **Gate: epic-01 done.** Runs parallel with epics 04/06 (lanes B/C).
- Epic-03's command-level tickets may start on this epic's branch once ticket 1's users shape is stable (roadmap fine-grained overlap) — coordinate, don't race migrations.
- No logout mutation by design (client-side discard — epic-08). Google OAuth + password reset are deferred-table rows, epic-14's registry.

## Kickoff delta review (2026-11-04, standing decide-all delegation — "全部按推荐")

No product questions open; the deltas below pin build-time choices the tickets left open, per the roadmap's delta-review convention:

1. **Gem pins:** `bcrypt` + `jwt`, floor-pinned `~>` at current stable (spine stack table line 247 — "current stable at scaffold"); runtime Gemfile group; exact versions in `Gemfile.lock`.
2. **Ticket 02 is the first schema movement:** mutations + `User` type land → in-container `graphql:schema:dump` → committed `schema.graphql` → frontend `pnpm codegen` regenerates `src/types/graphql.ts` **in the same change** (AD-17 one-contract rule); frontend gates (tsc -b) must stay green. Contract immobility checks in this epic assert the diff is *exactly* register/login + User type **plus the plumbing those two necessarily drag in** (wording amended 2026-11-04, review P2-9, to disclose the full sanctioned surface): the RelayClassicMutation machinery the scaffold's `BaseMutation` convention generates — `LoginInput`/`LoginPayload`, `RegisterInput`/`RegisterPayload` with `clientMutationId` — and the directive-less house `DateTime` scalar (both documented in T02's Comments; the scalar exists because printing the built-in's `@specifiedBy` argument breaks the IDL dump on the pinned graphql `~> 2.5.26`).
3. **Login rate limit:** in-memory per-window counter keyed by normalized email (A2 — api-local, no Redis per AD-19 posture); deterministic clock injected so specs don't sleep; threshold + window in ENV-overridable config; trip → `Failure(:RATE_LIMITED)`.
4. **Credentials rules:** password minimum 8 chars; email shape via Rails' `URI::MailTo::EMAIL_REGEXP`; emails normalized `downcase` before create (unique index exists from epic-01); duplicate email → `VALIDATION_FAILED` (pre-check + `RecordNotUnique` backstop); wrong credentials → `UNAUTHORIZED`, never revealing which half was wrong.
5. **`current_user`:** one memoized resolver object built in `GraphqlController`'s context; the mechanism + UNAUTHORIZED semantics land in ticket 02, per-op enforcement starts with epic-03's operations (register/login/health stay public).
6. **Token:** `sub` = user uuid + `exp` (~24h TTL), `JWT_SECRET` via ENV; `.env.example` + compose wiring in ticket 01; `DEMO_EMAIL`/`DEMO_PASSWORD` wiring rides ticket 03.
7. **Demo seed:** `db/seeds.rb` idempotent by stable uuid/email; shape-stub dataset = one plan + two nodes owned by the demo user (demo garnish per ticket 03; real content seeded closer to the graded window per AD-20).
8. **Inheritance from epic-01:** commands live under `app/commands/accounts/` per `Context::VerbNounCommand`; every Failure uses the closed enum; the shared scoping roster (`spec/models/user_scoping_spec.rb`) already covers User's association surface — ticket 02 adds the JWT-backed end-to-end proof the DoD requires.

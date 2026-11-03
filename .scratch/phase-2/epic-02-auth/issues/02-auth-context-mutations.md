# 02: GraphQL register/login mutations + current_user context + login rate limit

**What to build:** `register`/`login` mutations (thin: parse → authorize n/a → command → map Result) returning `{ token, user }`; GraphQL context resolving a memoized `current_user` from the Authorization bearer header — absent/invalid → `UNAUTHORIZED` for any op requiring auth; login attempts rate-limited per window (api-local storage, A2; value in config). `schema.graphql` grows by exactly these two mutations + User type.

**Blocked by:** 01.

**Status:** ready-for-agent

**Bound by:** AD-15 (bearer not cookies; rate-limited login), AD-12 (thin resolvers over commands; `extensions.code` presenter).

- [ ] Both mutations answer over HTTP; Result mapping via the epic-01 presenter
- [ ] Context: valid token → current_user; absent/garbage/expired → UNAUTHORIZED; one spec runs the epic-01 scoping context with a real JWT-backed user
- [ ] Rate limit trips with RATE_LIMITED; window resets
- [ ] No logout mutation exists (by design — client-side, epic-08)
- [ ] `schema.graphql` re-dump idempotent; web codegen still compiles against it

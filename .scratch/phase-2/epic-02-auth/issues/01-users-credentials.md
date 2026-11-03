# 01: Credentials + JWT primitives (command level)

**What to build:** `has_secure_password` + bcrypt on User; JWT encode/decode helpers (`JWT_SECRET` ENV, ~24h TTL, `sub` = user uuid + `exp`); `Accounts::RegisterUserCommand` + `Accounts::LoginUserCommand` (email shape + password minimum; duplicate email → `VALIDATION_FAILED`; wrong credentials → `UNAUTHORIZED`); `.env.example` grows `JWT_SECRET`.

**Blocked by:** None (epic gate: epic-01 done).

**Status:** ready-for-agent

**Bound by:** AD-15 (bcrypt + stateless JWT ~24h, no refresh/denylist — accepted risk), AD-12 (commands never raise; closed error enum).

- [ ] Register/login commands return Success(user, token) / typed Failures; tested directly per AD-10
- [ ] Token round-trips via decode helper; expiry boundary tested
- [ ] `.env.example` documents `JWT_SECRET`; compose wires it
- [ ] RuboCop clean

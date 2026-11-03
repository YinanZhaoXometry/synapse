# 02: Login wall — /login, /register, route guard, logout semantics

**What to build:** bilingual `/login` + `/register` pages (AD-9: i18n table, semantic tokens, both themes); token handling (A2: memory + storage choice at ticket; Authorization header wiring via an Apollo link); route guard redirecting unauthenticated users from app routes to /login while the pre-login surface (onboarding static shell) stays fully static per NFR-6; demo-account entry affordance; logout = discard token + `resetApiClient()` + SSE termination — no server state.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-15 (login wall ends the anonymous era; client-side logout), AD-9 (bilingual, accessible), AD-8 (one new route only — the wall; all addressing survives).

- [ ] Unauthenticated → /login; authenticated → prior destination; deep links survive login
- [ ] Error codes map to `t()` keys (UNAUTHORIZED/VALIDATION_FAILED/RATE_LIMITED shown humanely, zh+en)
- [ ] Logout leaves zero cached domain data + zero live streams (asserted)
- [ ] `synapse-db:v1` and UI-pref keys untouched by wall logic (rollback substrate)

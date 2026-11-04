# 02: Login wall — /login, /register, route guard, logout semantics

**What to build:** bilingual `/login` + `/register` pages (AD-9: i18n table, semantic tokens, both themes); token handling (A2: memory + storage choice at ticket; Authorization header wiring via an Apollo link); route guard redirecting unauthenticated users from app routes to /login while the pre-login surface (onboarding static shell) stays fully static per NFR-6; demo-account entry affordance; logout = discard token + `resetApiClient()` + SSE termination — no server state.

**Blocked by:** 1.

**Status:** done (2026-11-04, `c3c25b3` — CI 41833238037 双绿; review pending the epic's pre-merge pass)

**Bound by:** AD-15 (login wall ends the anonymous era; client-side logout), AD-9 (bilingual, accessible), AD-8 (one new route only — the wall; all addressing survives).

- [x] Unauthenticated → /login; authenticated → prior destination; deep links survive login (RequireAuth carries `from` router state; the wall walk asserts the round trip)
- [x] Error codes map to `t()` keys (UNAUTHORIZED/VALIDATION_FAILED/RATE_LIMITED + network fallback, zh+en); client-side rules mirror the api's (email shape, password ≥ 8) — the form is `noValidate` so the humane copy always wins over native bubbles (AD-9; jsdom+Chrome both block submits on invalid emails otherwise)
- [x] Logout leaves zero cached domain data + zero live streams (asserted — the isolation regression reads THE app client's cache and the terminator registry; next identity renders only its own rows)
- [x] `synapse-db:v1` and UI-pref keys untouched by wall logic (guard test pins the key; Settings logout keeps prefs — reset clears them)

**Delivered:** auth.graphql (Login/Register) + auth-queries · `src/apollo/session` (isLoggedIn + logout) · `/login` `/register` static glass shell (NFR-6) · demo entry (seed's dev defaults `demo@synapse.test`/`demo-password`) · RequireAuth on every app route + entry gate → /login when tokenless · Settings 退出登录 (prefs kept) beside 清除本机偏好 · 391/391 web.

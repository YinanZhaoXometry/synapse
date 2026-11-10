# T1 — Session-expiry teardown + ?next= redirect

Milestone: Phase 2 — post-deadline
Status: pending
Epic: epic-28-ux-hardening
Blocked by: —

## Problem

Stale JWT (server TTL 24h) → user stays in the shell, every query toasts
"authentication required" (`extensions.code: "UNAUTHORIZED"` from
`current_user_guard.rb:21-28`), nothing clears the token, nothing redirects
(`frontend/src/apollo/client.ts:34` — link chain is `from([authLink, httpLink])`, no
errorLink).

## AC

1. New `ErrorLink` in `frontend/src/apollo/client.ts` between authLink and httpLink:
   on `CombinedGraphQLErrors` carrying `extensions.code === "UNAUTHORIZED"` for an
   operation NOT named `Login`/`Register` (wrong-password must keep its inline
   authErrorKey surface, `auth-shell.tsx:20-27`) and only while a token still exists
   (single-flight): `clearToken()` + `await resetApiClient()` + hard
   `window.location.replace("/login?next=" + encodeURIComponent(pathname+search) +
   "&expired=1")`.
2. `sse-client.ts` terminal mapping: when the mapped code is UNAUTHORIZED, dispatch
   the same teardown (extract the teardown into one helper both call sites share —
   no duplicated seam logic). Non-UNAUTHORIZED terminal codes untouched.
3. `LoginPage`/`RegisterPage` destination resolution becomes
   `location.state?.from ?? sanitizeNext(searchParams.get("next")) ?? "/plans"`;
   `sanitizeNext` accepts only same-origin paths (starts with exactly one `/`, no
   `//`, no scheme). Demo-entry path keeps working (Pinned test
   `auth-wall.integration.test.tsx` must stay green untouched).
4. LoginPage on mount with `expired=1`: neutral toast `errors.sessionExpired`
   (new i18n key zh+en). The stale comments claiming the code is "UNAUTHENTICATED"
   (`client.ts:20`, `auth-token.ts:6`) are corrected in passing.
5. Logout carries the current path: `UserMenuButton.tsx:43` + `SettingsPage.tsx:314`
   redirect to `/login?next=…&out=1`; LoginPage shows `auth.signedOut` toast on
   `out=1`. (Factory-reset at `SettingsPage.tsx:508-529` keeps going to `/` — clean
   device, not a session end.)
6. Vitest: errorLink teardown unit spec (UNAUTHORIZED in-shell → token cleared +
   redirect attempted; Login op UNAUTHORIZED → untouched; no token → no-op) +
   login-page ?next= resolution spec incl. sanitize rejections. All gates green.

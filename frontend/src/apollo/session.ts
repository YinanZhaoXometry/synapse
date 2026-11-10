/**
 * The session helpers (epic P2-8 T2, AD-15): the login wall reads one boolean
 * — does a token exist? — and logout is the client-side cut: discard the
 * token, wipe the normalized cache, terminate every live stream. No server
 * state (the JWT simply expires; AD-15's client-side logout).
 */
import { clearToken, getToken } from "./auth-token";
import { resetApiClient } from "./reset";

/** True when a session token exists — the route guard's only question. */
export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/**
 * Logout (AD-15): discard the token + resetApiClient() (cache wipe + SSE
 * terminators). Zero cached domain data and zero live streams survive it —
 * the cross-user isolation regression test pins that contract.
 */
export async function logout(): Promise<void> {
  clearToken();
  await resetApiClient();
}

// -- Session-exit teardown (epic-28 T1) ------------------------------------------
//
// An expired JWT keeps the bearer inside the shell: every query answers
// UNAUTHORIZED and the features toast it, but nothing ends the session. The
// exit seam below is the ONE cut for both causes — server expiry (the Apollo
// errorLink, the SSE terminal mapping) and the user's own sign-out — and it
// carries the current path to /login in `?next=` so a successful login
// resumes exactly where the learner was. Hard reload, not SPA navigate: the
// house pattern for session teardown (UserMenuButton/SettingsPage) and the
// only shape that guarantees a clean slate after resetApiClient().

export type SessionExitReason = "expired" | "signout";

/**
 * A return path is honored only when it stays same-origin: one leading
 * slash, no protocol-relative `//`, no scheme, no backslash tricks. Anything
 * else → null (the caller falls back to /plans).
 */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("://") || raw.includes("\\") || raw.includes("\n") || raw.includes("\r")) {
    return null;
  }
  return raw;
}

/** The /login URL for a session exit: `?next=` + the reason flag the wall's
 * mount toasts read (`expired=1` → session-expired, `out=1` → signed-out). */
export function sessionExitUrl(reason: SessionExitReason, destination: string): string {
  const params = new URLSearchParams();
  if (destination) params.set("next", destination);
  params.set(reason === "expired" ? "expired" : "out", "1");
  return `/login?${params.toString()}`;
}

/**
 * End the session for real and bounce to the wall carrying the return path.
 * Single-flight: the first UNAUTHORIZED in a burst tears the token down
 * synchronously; every later caller sees no token and no-ops (a page with N
 * in-flight queries fires this N times but reloads once). The wall's own
 * surfaces never tear down — on /login //register an UNAUTHORIZED is a
 * credentials problem, not an expiry (the errorLink additionally guards by
 * operation name).
 */
export async function teardownSession(reason: SessionExitReason): Promise<void> {
  if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/register")) {
    return;
  }
  if (getToken() === null) return;
  const destination = window.location.pathname + window.location.search;
  await logout();
  window.location.replace(sessionExitUrl(reason, destination));
}

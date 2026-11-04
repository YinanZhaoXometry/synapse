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

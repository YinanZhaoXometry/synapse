/**
 * The auth token seam (AD-15, epic P2-8): where the JWT lives between the api
 * and every request. localStorage-backed (spec A2: memory-only was rejected —
 * reload = logout friction for a study app), read by the Apollo auth link;
 * login/logout (ticket 02) are the only writers outside tests. Expiry is the
 * server's 24h TTL — a stale token surfaces as an UNAUTHENTICATED error, never
 * a silent failure.
 */
const TOKEN_KEY = "synapse-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode, jsdom edge) — nothing to clear
  }
}

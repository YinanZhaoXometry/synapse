/**
 * The auth token seam (AD-15, epic P2-8): where the JWT lives between the api
 * and every request. localStorage-backed (spec A2: memory-only was rejected —
 * reload = logout friction for a study app), read by the Apollo auth link;
 * login/logout (ticket 02) are the only writers outside tests. Expiry is the
 * server's 24h TTL — a stale token surfaces as an UNAUTHORIZED error, never
 * a silent failure (and the errorLink ends the session: epic-28 T1).
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

/**
 * The authed user's uuid, read off the session JWT's `sub` claim — the ONLY
 * runtime view of the account id the wire exposes (User rides the
 * login/register payloads, consumed at the wall; no query returns the
 * current user). The token is server-minted (Accounts::TokenCodec: payload
 * { sub, exp }) and signature-verified on every api call — this READS the
 * claim, it does not authenticate. Consumers derive user-scoped keys from it
 * (the Today suggestion's uuid5 replay key, epic-18 T4); null (no session,
 * unreadable payload) means such a key cannot be derived.
 */
export function authedUserUuid(): string | null {
  const token = getToken();
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    // JWT payloads are base64url unpadded — atob wants standard padding.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const sub = JSON.parse(atob(padded))?.sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

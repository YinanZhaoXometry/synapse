/**
 * The Apollo seam (AD-18) — the app's only route to the api. Everything
 * domain-data-shaped flows through the typed hooks layer (`src/api/queries`);
 * this module owns the client itself.
 */
export { apolloClient, createApolloClient, getApolloClient } from "./client";
export { authedUserUuid, clearToken, getToken, setToken } from "./auth-token";
export { registerStreamTerminator, resetApiClient } from "./reset";
export { isLoggedIn, logout, sanitizeReturnPath, sessionExitUrl, teardownSession } from "./session";
export type { SessionExitReason } from "./session";
export type { StreamTerminator } from "./reset";

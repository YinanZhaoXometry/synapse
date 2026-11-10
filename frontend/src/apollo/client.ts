/**
 * The Apollo Client 4 singleton (AD-18): the normalized cache is the single
 * client-side owner of domain data — no domain contexts, no local-mode shim.
 *
 * The http uri is relative by default: the Vite dev server proxies /graphql
 * (and the SSE surface /api/stream) to the api on :3000, keeping the browser
 * same-origin in development. A deployed build sets VITE_API_URL (ticket 06's
 * envelope: CF Pages → Render, CORS_ORIGIN allowlist).
 */
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, from } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { SetContextLink } from "@apollo/client/link/context";
import { getToken } from "./auth-token";
import { teardownSession } from "./session";

function apiUri(): string {
  return import.meta.env.VITE_API_URL ?? "/graphql";
}

/**
 * The session-expiry guard (epic-28 T1), kept link-shaped so the contract is
 * unit-testable in isolation: an in-shell UNAUTHORIZED tears the session down
 * through the one seam; the wall's own Login/Register mutations are exempt
 * (wrong-password keeps its inline surface). Everything else passes through.
 */
export function sessionGuardLink(): ApolloLink {
  return new ErrorLink(({ error, operation }) => {
    if (!(error instanceof CombinedGraphQLErrors)) return;
    if (!error.errors.some((e) => e.extensions?.code === "UNAUTHORIZED")) return;
    if (operation.operationName === "Login" || operation.operationName === "Register") return;
    void teardownSession("expired");
  });
}

export function createApolloClient(): ApolloClient {
  // Every request carries the bearer token when one exists (ticket 02 wires
  // login; until then the api answers UNAUTHORIZED, which is honest).
  const authLink = new SetContextLink((previous) => {
    const token = getToken();
    return {
      headers: {
        ...previous.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  // The session-expiry guard (epic-28 T1): an in-shell UNAUTHORIZED means the
  // bearer is dead (the wall's 24h TTL) — end the session through the one
  // seam (teardownSession: token + cache + streams + /login?next=) instead of
  // letting the user marinate in per-feature "session expired" toasts. The
  // wall's own Login/Register mutations are exempt — UNAUTHORIZED there is a
  // wrong-password problem, and it must keep the inline authErrorKey surface.
  const errorLink = sessionGuardLink();

  const httpLink = new HttpLink({ uri: apiUri() });

  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache(),
    // Queries the user did not ask for must never mask a failure (the phase-1
    // "never silent" posture): errors surface through `error` immediately.
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}

export const apolloClient = createApolloClient();

export function getApolloClient(): ApolloClient {
  return apolloClient;
}

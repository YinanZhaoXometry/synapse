/**
 * The Apollo Client 4 singleton (AD-18): the normalized cache is the single
 * client-side owner of domain data — no domain contexts, no local-mode shim.
 *
 * The http uri is relative by default: the Vite dev server proxies /graphql
 * (and the SSE surface /api/stream) to the api on :3000, keeping the browser
 * same-origin in development. A deployed build sets VITE_API_URL (ticket 06's
 * envelope: CF Pages → Render, CORS_ORIGIN allowlist).
 */
import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { getToken } from "./auth-token";

function apiUri(): string {
  return import.meta.env.VITE_API_URL ?? "/graphql";
}

export function createApolloClient(): ApolloClient {
  // Every request carries the bearer token when one exists (ticket 02 wires
  // login; until then the api answers UNAUTHENTICATED, which is honest).
  const authLink = new SetContextLink((previous) => {
    const token = getToken();
    return {
      headers: {
        ...previous.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const httpLink = new HttpLink({ uri: apiUri() });

  return new ApolloClient({
    link: from([authLink, httpLink]),
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

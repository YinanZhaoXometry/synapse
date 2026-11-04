/**
 * The closed api error enum, web side (epic P2-8 T1): GraphQL errors carry
 * `extensions.code` ∈ ApplicationErrors::CODES (epic P2-1's closed enum,
 * mirrored verbatim). Features read the code — never the message string
 * (backend contract: match on the code, never the message). `null` = not an
 * api error (network failure, parse error) — render the generic failure key.
 *
 * Apollo 4 error model: hooks expose `error?: ErrorLike`; api codes ride
 * `CombinedGraphQLErrors` instances (`.errors[].extensions.code`).
 */
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import type { ErrorLike } from "@apollo/client";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "CAP_REACHED"
  | "INTERNAL";

/** First api error code carried by a query/mutation error, or null when none. */
export function apiErrorCode(error: ErrorLike | undefined | null): ApiErrorCode | null {
  if (error && CombinedGraphQLErrors.is(error)) {
    for (const graphqlError of error.errors) {
      const code = graphqlError.extensions?.code;
      if (typeof code === "string") return code as ApiErrorCode;
    }
  }
  return null;
}

/**
 * The closed enum → t()-key SUFFIX map (AD-9, one place): the ai surfaces
 * derive their sibling namespaces from it — the streams prefix `ai.stream.`
 * (src/ai/sse-client.ts), the generation mutations prefix `ai.generate.`
 * (src/ai/companion-service-server.ts) — so the two maps can never drift
 * apart on the enum or on a suffix. Copy itself lives in the i18n dictionary.
 */
export const API_ERROR_KEY_SUFFIXES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "errorUnauthorized",
  FORBIDDEN: "errorForbidden",
  NOT_FOUND: "errorNotFound",
  VALIDATION_FAILED: "errorValidation",
  RATE_LIMITED: "errorRateLimited",
  CAP_REACHED: "capReached",
  INTERNAL: "errorInternal",
};

/** The closed enum walked in declaration order — the derivation helper. */
export function apiErrorCodes(): ApiErrorCode[] {
  return Object.keys(API_ERROR_KEY_SUFFIXES) as ApiErrorCode[];
}

/** Prefix each enum code's suffix into a full namespaced t()-key map. */
export function apiErrorKeys(namespace: string): Record<ApiErrorCode, string> {
  const keys = {} as Record<ApiErrorCode, string>;
  for (const code of apiErrorCodes()) {
    keys[code] = `${namespace}${API_ERROR_KEY_SUFFIXES[code]}`;
  }
  return keys;
}

/** True when an error arrived but carries no api code — transport/parse failure. */
export function isNetworkError(error: ErrorLike | undefined | null): boolean {
  return Boolean(error) && apiErrorCode(error) === null;
}

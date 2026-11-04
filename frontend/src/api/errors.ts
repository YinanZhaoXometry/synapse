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

/** True when an error arrived but carries no api code — transport/parse failure. */
export function isNetworkError(error: ErrorLike | undefined | null): boolean {
  return Boolean(error) && apiErrorCode(error) === null;
}

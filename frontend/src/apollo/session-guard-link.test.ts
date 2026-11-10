/**
 * The session-expiry guard link (epic-28 T1): the one Apollo-level cut for a
 * dead bearer. An in-shell UNAUTHORIZED tears the session down through the
 * one seam; the wall's own Login/Register mutations keep their inline
 * wrong-password surface; any other code (or a non-GraphQL failure) passes
 * through untouched. The teardown itself is mocked here — its guards are
 * pinned in session-expiry.test.ts.
 */
import { ApolloLink, Observable } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { execute } from "@apollo/client/link";
import { parse } from "graphql";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ teardownSession: vi.fn().mockResolvedValue(undefined) }));

import { sessionGuardLink, getApolloClient } from "./client";
import { teardownSession } from "./session";

const PLANS_DOC = parse("query Plans { plans { id } }");
const LOGIN_DOC = parse("mutation Login($input: LoginInput!) { login(input: $input) { token } }");
const REGISTER_DOC = parse("mutation Register($input: RegisterInput!) { register(input: $input) { token } }");

function unauthorized(): CombinedGraphQLErrors {
  // AC4 constructor shape: (result, errors = result.errors) — the raw list
  // rides the SECOND argument, exactly how ErrorLink builds it on the wire.
  return new CombinedGraphQLErrors({}, [
    { message: "authentication required", extensions: { code: "UNAUTHORIZED" } },
  ]);
}

/** A terminal downstream: every operation fails with the given error. */
function failingWith(error: unknown): ApolloLink {
  return new ApolloLink(() => new Observable((observer) => observer.error(error)));
}

beforeEach(() => {
  vi.mocked(teardownSession).mockClear();
});

function run(link: ApolloLink, query: ReturnType<typeof parse>): Promise<unknown> {
  // AC4 execute takes the ExecuteContext ({ client }) as its third argument —
  // the same client instance the real chain rides.
  return new Promise((resolve, reject) => {
    execute(link, { query }, { client: getApolloClient() }).subscribe({ next: resolve, error: reject });
  });
}

describe("sessionGuardLink (epic-28 T1)", () => {
  it("an in-shell UNAUTHORIZED tears the session down", async () => {
    await expect(run(sessionGuardLink().concat(failingWith(unauthorized())), PLANS_DOC)).rejects.toBeTruthy();
    expect(teardownSession).toHaveBeenCalledTimes(1);
    expect(teardownSession).toHaveBeenCalledWith("expired");
  });

  it("the wall's own Login mutation is exempt (wrong-password keeps its inline surface)", async () => {
    await expect(run(sessionGuardLink().concat(failingWith(unauthorized())), LOGIN_DOC)).rejects.toBeTruthy();
    expect(teardownSession).not.toHaveBeenCalled();
  });

  it("the wall's own Register mutation is exempt too", async () => {
    await expect(run(sessionGuardLink().concat(failingWith(unauthorized())), REGISTER_DOC)).rejects.toBeTruthy();
    expect(teardownSession).not.toHaveBeenCalled();
  });

  it("any other api code is business-as-usual (per-feature toasts own it)", async () => {
    const notFound = new CombinedGraphQLErrors({}, [
      { message: "not found", extensions: { code: "NOT_FOUND" } },
    ]);
    await expect(run(sessionGuardLink().concat(failingWith(notFound)), PLANS_DOC)).rejects.toBeTruthy();
    expect(teardownSession).not.toHaveBeenCalled();
  });

  it("a non-GraphQL failure (network/parse) never touches the session", async () => {
    await expect(run(sessionGuardLink().concat(failingWith(new Error("socket hang up"))), PLANS_DOC)).rejects.toBeTruthy();
    expect(teardownSession).not.toHaveBeenCalled();
  });
});

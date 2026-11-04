/**
 * The stub-GraphQL test harness (epic P2-8; spec testing decisions: web tests
 * stay deterministic and offline). A real ApolloClient whose link is an
 * in-memory ECHO SERVER: operations are answered by per-operation handlers
 * that derive payloads from the request variables (echo semantics — a create
 * returns the created row, recordEvidence returns the batch it "wrote"). The
 * harness keeps the server-side state a test asserts on (sessions, evidence,
 * mistakes), replacing the Phase-1 localStorage reads.
 *
 * Handlers are OPTIONAL — an operation without a handler answers a minimal
 * `{ __typename }` payload, so a test wires exactly the operations it walks.
 */
import type { ReactNode } from "react";
import { ApolloClient, ApolloLink, InMemoryCache, from } from "@apollo/client";
import type { FetchResult, Operation } from "@apollo/client";
import { Observable } from "rxjs";
import { ApolloProvider } from "@apollo/client/react";

export interface HarnessState {
  sessions: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  mistakes: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
}

export type OperationHandler = (variables: Record<string, unknown>, state: HarnessState) => Record<string, unknown> | undefined;

/**
 * The echo fixtures intentionally mirror the WIRE, not app types: handlers
 * derive payloads from request variables and the captured server rows, whose
 * shapes are the server's own — every fixture rides this one loose record
 * instead of bare `any` annotations (payload structure is checked on read by
 * the mappers, never by the fixture types).
 */
export type EchoFixture = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The harness's captured server state — a test's assertion surface. */
export function createHarnessState(): HarnessState {
  return { sessions: [], evidence: [], mistakes: [], plans: [] };
}

function answerOperation(
  operation: Operation,
  handlers: Record<string, (variables: EchoFixture, state: HarnessState) => unknown>,
  state: HarnessState,
) {
  const operationName = operation.operationName;
  const handler = operationName ? handlers[operationName] : undefined;
  const variables = (operation.variables ?? {}) as Record<string, unknown>;
  const payload = handler ? handler(variables, state) : undefined;
  // The field name on the payload root equals the field the operation selected
  // (createQuizSession / recordEvidence / ...); GraphQL root fields are
  // camelCase operation-derived, so derive it from the query document.
  let rootField: string | undefined;
  for (const definition of operation.query.definitions) {
    if (definition.kind === "OperationDefinition" && definition.selectionSet.selections[0]?.kind === "Field") {
      rootField = (definition.selectionSet.selections[0] as { name: { value: string } }).name.value;
      break;
    }
  }
  return rootField ? { data: { [rootField]: payload ?? { __typename: rootField } } } : { data: {} };
}

/** The handler map accepts BOTH shapes: the strict OperationHandler contract
 * (the reference driver tests) and the walks' EchoFixture-widened maps — list
 * roots return arrays, so the loose entry type is the wire-record one, with
 * `unknown` returns. */
export function createStubClient(
  handlers: Record<string, (variables: EchoFixture, state: HarnessState) => unknown>,
  state: HarnessState,
): ApolloClient {
  const link = new ApolloLink((operation) => {
    // run on the next tick so mutations resolve like a network round trip
    return new Observable<FetchResult>((observer) => {
      const timer = setTimeout(() => {
        try {
          observer.next(answerOperation(operation, handlers, state));
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      }, 0);
      return () => clearTimeout(timer);
    });
  });
  return new ApolloClient({ link: from([link]), cache: new InMemoryCache() });
}

/** The provider wrapper a renderHook/render call mounts under. */
export function makeStubWrapper(client: ApolloClient) {
  return function StubWrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

/** Helper: the server-shaped Question echo of a generated question input. */
export function echoQuestion(input: Record<string, unknown>, sessionId: string, index: number): Record<string, unknown> {
  return {
    __typename: "Question",
    id: `q-echo-${index}`,
    sessionId,
    nodeId: input.nodeId,
    kind: input.kind,
    prompt: input.prompt,
    options: input.options ?? null,
    correctOptionIndex: input.correctOptionIndex ?? null,
    sourceMaterialId: input.sourceMaterialId,
    sourceSectionId: input.sourceSectionId,
    keywords: input.keywords ?? null,
    explanation: input.explanation,
  };
}

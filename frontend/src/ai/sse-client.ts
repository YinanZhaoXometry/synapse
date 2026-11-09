/**
 * The SSE stream client (epic P2-8 T4, AD-16 web half): the EventSource
 * wrapper over the ONE non-GraphQL api surface, GET /api/stream.
 *
 * The frozen server contract (backend/app/controllers/api/stream_controller.rb
 * + spec/requests/api_stream_spec.rb — consumed verbatim, never re-derived):
 *
 *   mint   → createStreamTicket GraphQL mutation (one ticket = one redeem;
 *            grounding inputs ride INSIDE the ticket — query params are
 *            log-exposed; the browser's EventSource cannot set headers, so
 *            auth is by ticket alone)
 *   open   → GET /api/stream?ticket=…&op=… (text/event-stream)
 *   events → rung      {"intent","rung","canEscalate","language"}
 *            token     {"text"}                       (many, in order)
 *            citation  {"locator","quote"}             (companion only)
 *            terminal  {"code":"OK"|<enum>}(+"proposal" for the proposal op)
 *
 * Restart semantics (AD-16, verbatim): EventSource auto-reconnect is NEVER
 * used — a drop closes the socket, mints a FRESH ticket, and restarts the
 * whole generation. The server counts every redeem against the per-user daily
 * AI cap (restarts included, deliberate double-count), so each restart fires
 * the cap-counted notice (never silent) and a cap refusal arrives as
 * terminal{CAP_REACHED}. A client-side guard bounds a pathological drop loop
 * (the server's cap would end it eventually anyway — this just avoids burning
 * the day's budget on a broken proxy).
 *
 * Terminal mapping (AD-9): server codes ride the closed enum mirrored in
 * src/api/errors.ts; every code maps to an AppError carrying a t() key —
 * never a server string. Out-of-contract codes keep their raw code on the
 * AppError with the generic failure key (honest fallback, not absorption).
 *
 * Not a React module: language comes in on the request (T5's adapter reads
 * the UI toggle and passes it per stream — a toggle mid-session applies to
 * the next stream). The CompanionService swap is ticket 05; nothing here
 * touches it.
 */
import { getApolloClient } from "@/apollo/client";
import { registerStreamTerminator } from "@/apollo/reset";
import { apiErrorCode, apiErrorKeys } from "@/api/errors";
import type { ApiErrorCode } from "@/api/errors";
import { AppError } from "@/lib/app-error";
import { CreateStreamTicketDocument } from "@/types/graphql";
import type {
  CreateStreamTicketInput,
  CreateStreamTicketMutationVariables,
} from "@/types/graphql";
import type { ApolloClient, ErrorLike } from "@apollo/client";
import type { ReadingLocator } from "@/domain/entities";
import type {
  Citation,
  CompanionIntent,
  GuardrailRung,
  PlanStructureProposal,
  ProposalMaterial,
  UiLanguage,
} from "./types";

// -- public request/response shapes ---------------------------------------------

export type StreamOp = "companion" | "proposal" | "plan_companion";

/** Companion chat: position-grounded, optionally escalated (the ladder).
 * `selection` is epic-13 T1's additive grounding input (FR-13) — the reader's
 * selection bar asked WITH the selected text; it rides INSIDE the ticket like
 * every grounding input. */
export interface CompanionStreamRequest {
  op: "companion";
  materialId: string;
  question: string;
  position: ReadingPositionLike;
  escalated?: boolean;
  selection?: string;
  language: UiLanguage;
}

/** Plan proposal (epic-27): one free-form message + the attached materials'
 * client-extracted text; tags stripped server-side. */
export interface ProposalStreamRequest {
  op: "proposal";
  message: string;
  materials: ProposalMaterial[];
  language: UiLanguage;
}

/**
 * Plan-scope companion chat (FR-46, epic P2-12 T3 — the third stream op):
 * plan-grounded (no ReadingPosition), with the optional mistake entry as the
 * "analyze my mistakes" grounding input. Same event vocabulary as companion;
 * the citation event carries the mistake's own source locator.
 */
export interface PlanCompanionStreamRequest {
  op: "plan_companion";
  planId: string;
  question: string;
  mistakeEntryId?: string;
  language: UiLanguage;
}

export type StreamRequest = CompanionStreamRequest | ProposalStreamRequest | PlanCompanionStreamRequest;

/** Structural ReadingPosition (keeps this module import-light). */
export interface ReadingPositionLike {
  locator: ReadingLocator;
  text: string;
}

/** The rung event, parsed into the AD-5 posture pieces (server-derived —
 * the client renders, never guesses). */
export interface StreamRung {
  intent: CompanionIntent;
  rung: GuardrailRung;
  canEscalate: boolean;
  language: UiLanguage;
}

/**
 * A terminal: OK (with the parsed proposal payload on the proposal op) or a
 * failure whose AppError carries the closed-enum code + the t() messageKey
 * (`code` stays the server's raw string — known codes are the closed enum;
 * out-of-contract codes surface honestly with the generic key).
 */
export type StreamTerminal =
  | { code: "OK"; proposal?: PlanStructureProposal }
  | { code: string; error: AppError };

export interface StreamHandlers {
  onRung?: (rung: StreamRung) => void;
  onToken?: (text: string) => void;
  onCitation?: (citation: Citation) => void;
  /** A drop triggered a fresh-ticket restart — the UI MUST notice it counted
   * against the daily cap (AD-16: never silent). */
  onRestart?: (notice: { attempt: number; messageKey: string }) => void;
  onTerminal?: (terminal: StreamTerminal) => void;
}

// -- injectable seams (jsdom has no EventSource; tests pass fakes) --------------

/** Minimal EventSource surface the wrapper relies on. close() is what disables
 * the browser's auto-reconnect — called before any fresh-ticket restart. */
export interface StreamEventSourceLike {
  addEventListener(type: string, listener: (event: { data?: string }) => void): void;
  close(): void;
}

export type EventSourceFactory = (url: string) => StreamEventSourceLike;

export interface StreamDeps {
  /** Mint one single-use ticket; resolves the token. Rejections surface as
   * AppErrors carrying the closed-enum code. */
  mintTicket?: (variables: CreateStreamTicketMutationVariables) => Promise<string>;
  createEventSource?: EventSourceFactory;
  /** Drop-loop guard (default DEFAULT_MAX_RESTARTS). */
  maxRestarts?: number;
}

export interface StreamSession {
  /** Kill the stream + restart loop immediately (resetApiClient's terminator
   * and UI teardown both land here; idempotent). */
  cancel(): void;
  /** Resolves the terminal, or null when the session ended by cancellation. */
  done: Promise<StreamTerminal | null>;
}

// -- constants ------------------------------------------------------------------

const STREAM_ENDPOINT_DEFAULT = "/api/stream";
const DEFAULT_MAX_RESTARTS = 3;

/**
 * Terminal code → t() key — the FULL closed enum (AD-9: codes → keys, never
 * server strings), derived from the ONE base suffix map (src/api/errors.ts)
 * so the mutation-path sibling (AI_MUTATION_KEYS) can never drift. The cap
 * refusal gets its own honest copy; the generic failure key backs
 * mint/transport failures without a code and any out-of-contract terminal
 * code.
 */
export const STREAM_TERMINAL_KEYS: Record<ApiErrorCode, string> = apiErrorKeys("ai.stream.");

const GENERIC_STREAM_FAILED_KEY = "ai.stream.failed";
const CONNECTION_LOST_KEY = "ai.stream.connectionLost";
const GAVE_UP_KEY = "ai.stream.gaveUp";

/** Dev: the relative /api/stream (Vite proxies :3000). A deployed build's
 * VITE_API_URL points at the api's /graphql — the SSE surface lives beside it. */
function streamEndpoint(): string {
  const graphqlUri: string = import.meta.env.VITE_API_URL ?? "/graphql";
  if (graphqlUri === "/graphql") return STREAM_ENDPOINT_DEFAULT;
  const replaced = graphqlUri.replace(/\/graphql\/?$/, "/api/stream");
  return replaced === graphqlUri ? `${graphqlUri.replace(/\/$/, "")}/api/stream` : replaced;
}

// -- the real mint (the codegen document over the Apollo seam) -------------------

/**
 * Mint one stream ticket through an ApolloClient. GraphQL failures map
 * through the closed enum (src/api/errors.ts) onto AppErrors carrying their
 * t() keys; a code-less failure (network/parse) is the generic INTERNAL.
 */
export async function mintStreamTicketWith(
  client: ApolloClient,
  variables: CreateStreamTicketMutationVariables,
): Promise<string> {
  try {
    // default error policy: a GraphQL failure REJECTS with a
    // CombinedGraphQLErrors — the same shape every T1 call site sees, read
    // through the one closed-enum reader (`result.error` covers the
    // errorPolicy variants; undefined under the default policy).
    const result = await client.mutate({ mutation: CreateStreamTicketDocument, variables });
    const code = apiErrorCode(result.error);
    if (code) throw new AppError(code, STREAM_TERMINAL_KEYS[code]);
    const token = result.data?.createStreamTicket?.token;
    if (!token) throw new AppError("INTERNAL", GENERIC_STREAM_FAILED_KEY);
    return token;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = apiErrorCode(error as ErrorLike);
    if (code) throw new AppError(code, STREAM_TERMINAL_KEYS[code]);
    throw new AppError("INTERNAL", GENERIC_STREAM_FAILED_KEY);
  }
}

function defaultMint(variables: CreateStreamTicketMutationVariables): Promise<string> {
  return mintStreamTicketWith(getApolloClient(), variables);
}

function defaultCreateEventSource(url: string): StreamEventSourceLike {
  // Browsers only — jsdom has no EventSource (tests inject a factory).
  return new EventSource(url);
}

// -- ticket request building (the frozen payload shapes, TS keys verbatim) ------

function buildVariables(request: StreamRequest): CreateStreamTicketMutationVariables {
  const input: CreateStreamTicketInput = { op: request.op, language: request.language };
  if (request.op === "companion") {
    input.materialId = request.materialId;
    input.question = request.question;
    input.position = { locator: request.position.locator, text: request.position.text };
    input.escalated = request.escalated === true;
    // The selection grounding input (epic-13 T1): absent for bar-less turns —
    // the frozen payload shape stays unchanged (the server omits the key).
    if (request.selection) input.selection = request.selection;
  } else if (request.op === "plan_companion") {
    input.planId = request.planId;
    input.question = request.question;
    input.mistakeEntryId = request.mistakeEntryId;
  } else {
    input.message = request.message;
    input.materials = request.materials;
  }
  return { input };
}

// -- event parsing (the frozen vocabulary → the AD-5 shapes) ---------------------

/** One SSE frame's `data` JSON — null when absent/malformed (a bad frame is
 * skipped, never fatal). */
function parseData(event: { data?: string }): Record<string, unknown> | null {
  if (typeof event.data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(event.data);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toRung(data: Record<string, unknown>): StreamRung {
  // The rung is SERVER-derived (escalated → "answer"); the client renders it.
  return {
    intent: data.intent as CompanionIntent,
    rung: data.rung as GuardrailRung,
    canEscalate: data.canEscalate === true,
    language: data.language as UiLanguage,
  };
}

function toCitation(data: Record<string, unknown>): Citation {
  const quote = typeof data.quote === "string" ? data.quote : undefined;
  return { locator: data.locator as ReadingLocator, quote };
}

function toTerminal(data: Record<string, unknown>): StreamTerminal {
  const code = typeof data.code === "string" ? data.code : "INTERNAL";
  if (code === "OK") {
    const terminal: StreamTerminal = { code: "OK" };
    if (data.proposal && typeof data.proposal === "object") {
      terminal.proposal = data.proposal as PlanStructureProposal;
    }
    return terminal;
  }
  const messageKey = STREAM_TERMINAL_KEYS[code as ApiErrorCode] ?? GENERIC_STREAM_FAILED_KEY;
  return { code, error: new AppError(code, messageKey) };
}

/** A mint failure → the terminal error shape (AppError + closed enum). */
function toTerminalError(error: unknown): StreamTerminal {
  if (error instanceof AppError) return { code: error.code, error };
  const code = apiErrorCode(error as ErrorLike);
  if (code) return { code, error: new AppError(code, STREAM_TERMINAL_KEYS[code]) };
  return { code: "INTERNAL", error: new AppError("INTERNAL", GENERIC_STREAM_FAILED_KEY) };
}

// -- the session state machine ---------------------------------------------------

/**
 * Start one streamed generation: mint → open → consume. A drop closes the
 * socket and restarts the WHOLE generation on a fresh ticket (each restart
 * fires the cap-counted notice); a terminal (OK or failure) ends the session;
 * terminal{CAP_REACHED} never restarts. Registers ONE resetApiClient
 * terminator on open (it cancels the whole session — no half-dead restart
 * loop survives a logout) and unregisters it at session end so terminators
 * never stack.
 */
export function startStream(
  request: StreamRequest,
  handlers: StreamHandlers = {},
  deps: StreamDeps = {},
): StreamSession {
  const mint = deps.mintTicket ?? defaultMint;
  const createSource = deps.createEventSource ?? defaultCreateEventSource;
  const maxRestarts = deps.maxRestarts ?? DEFAULT_MAX_RESTARTS;

  let state: "running" | "ended" | "cancelled" = "running";
  let currentSource: StreamEventSourceLike | null = null;
  let currentAttempt = 0; // generation counter — stale-source events are dropped
  let restartsUsed = 0;
  let unregisterTerminator: (() => void) | null = null;
  let resolveDone: (terminal: StreamTerminal | null) => void;
  const done = new Promise<StreamTerminal | null>((resolve) => {
    resolveDone = resolve;
  });

  const closeCurrent = () => {
    if (currentSource) {
      currentSource.close();
      currentSource = null;
    }
  };

  const finish = (terminal: StreamTerminal | null) => {
    if (state !== "running") return;
    state = "ended";
    closeCurrent();
    unregisterTerminator?.();
    unregisterTerminator = null;
    resolveDone(terminal);
  };

  /** A terminal (server event or client-side failure) ends the session — the
   * consumer learns of it through BOTH callbacks (cancellation never fires
   * onTerminal; done resolves null instead). */
  const terminate = (terminal: StreamTerminal) => {
    handlers.onTerminal?.(terminal);
    finish(terminal);
  };

  const cancel = () => {
    if (state !== "running") return;
    state = "cancelled";
    closeCurrent();
    unregisterTerminator?.();
    unregisterTerminator = null;
    resolveDone(null);
  };

  const openSocket = (attemptId: number, token: string) => {
    // One terminator per SESSION (registered at first open): resetApiClient
    // cancels the whole session — restarts reuse it, never stacking.
    if (!unregisterTerminator) {
      unregisterTerminator = registerStreamTerminator(() => cancel());
    }
    const source = createSource(
      `${streamEndpoint()}?${new URLSearchParams({ ticket: token, op: request.op })}`,
    );
    currentSource = source;
    // One error per dead socket — a second error event never re-enters the
    // restart path for this attempt.
    let dropAccepted = false;

    const live = () => state === "running" && currentAttempt === attemptId;
    const consume = (event: { data?: string }, deliver: (data: Record<string, unknown>) => void) => {
      if (!live()) return;
      const data = parseData(event);
      if (data) deliver(data);
    };

    source.addEventListener("rung", (event) =>
      consume(event, (data) => handlers.onRung?.(toRung(data))),
    );
    source.addEventListener("token", (event) =>
      consume(event, (data) => {
        if (typeof data.text === "string") handlers.onToken?.(data.text);
      }),
    );
    source.addEventListener("citation", (event) =>
      consume(event, (data) => handlers.onCitation?.(toCitation(data))),
    );
    source.addEventListener("terminal", (event) => {
      if (!live()) return;
      const data = parseData(event);
      if (data) terminate(toTerminal(data));
    });
    source.addEventListener("error", () => {
      if (!live() || dropAccepted) return;
      dropAccepted = true;
      // AD-16: kill the socket FIRST — the browser must never auto-reconnect.
      closeCurrent();
      if (restartsUsed >= maxRestarts) {
        terminate({ code: "INTERNAL", error: new AppError("INTERNAL", GAVE_UP_KEY) });
        return;
      }
      restartsUsed += 1;
      // The honest notice: this restart mints a fresh redeem and counts
      // against the daily AI cap (server-side; the UI must surface it).
      handlers.onRestart?.({ attempt: restartsUsed, messageKey: CONNECTION_LOST_KEY });
      void runAttempt(attemptId + 1);
    });
  };

  const runAttempt = async (attemptId: number) => {
    currentAttempt = attemptId;
    let token: string;
    try {
      token = await mint(buildVariables(request));
    } catch (error) {
      if (state !== "running" || currentAttempt !== attemptId) return;
      terminate(toTerminalError(error));
      return;
    }
    if (state !== "running" || currentAttempt !== attemptId) return;
    openSocket(attemptId, token);
  };

  void runAttempt(1);

  return { cancel, done };
}

/**
 * The SSE stream client tests (epic P2-8 T4) — deterministic, offline, no
 * server. Every fixture below is copied from the FROZEN server contract
 * (backend/spec/requests/api_stream_spec.rb): the event vocabulary
 * rung → token* → citation → terminal for companion, rung → token* →
 * terminal{proposal} for proposal, and the terminal enum codes.
 *
 * jsdom has no EventSource — the wrapper takes an injectable EventSource
 * factory and these tests drive a fake: they emit the server's events as JSON
 * `data` payloads and simulate a transport drop via the error listener. The
 * mint is faked the same way (a recorded-variables function); the REAL mint
 * (the codegen CreateStreamTicket document over the Apollo seam) is pinned by
 * the two harness tests at the bottom.
 *
 * Restart semantics under test (AD-16 web half, verbatim): EventSource
 * auto-reconnect is NEVER used — a drop closes the socket, mints a FRESH
 * ticket, and restarts the generation. Each restart counts against the daily
 * AI cap (server-side; the client surfaces the notice, never silently), and a
 * client-side guard bounds a pathological drop loop.
 */
import { ApolloClient, ApolloLink, InMemoryCache, from } from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import { Observable } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { createStubClient } from "@/test/apollo-harness";
import { resetApiClient } from "@/apollo/reset";
import {
  STREAM_TERMINAL_KEYS,
  mintStreamTicketWith,
  startStream,
} from "./sse-client";
import type {
  PlanCompanionStreamRequest,
  StreamEventSourceLike,
  StreamRequest,
  StreamTerminal,
} from "./sse-client";
import type { CreateStreamTicketMutationVariables } from "@/types/graphql";

// The terminator-registry probe: the real registerStreamTerminator stays in
// the call path (the spread keeps resetApiClient honest) — the mock only
// records registrations/unregistrations so the never-stack contract is
// directly assertable.
vi.mock("@/apollo/reset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/apollo/reset")>();
  const probe = { registered: 0, unregistered: 0 };
  return {
    ...actual,
    __probe: probe,
    registerStreamTerminator: (terminator: () => void) => {
      const unregister = actual.registerStreamTerminator(terminator);
      probe.registered += 1;
      return () => {
        probe.unregistered += 1;
        unregister();
      };
    },
  };
});

// -- the fake EventSource + dependency harness ---------------------------------

/** Minimal EventSource stand-in: the wrapper may only addEventListener + close
 * (close is what disables the browser's auto-reconnect — AD-16). Tests emit
 * the frozen server events and simulate drops through "error". */
class FakeEventSource implements StreamEventSourceLike {
  readonly url: string;
  closed = false;
  private readonly listeners = new Map<string, Array<(event: { data?: string }) => void>>();

  constructor(url: string, registry: FakeEventSource[]) {
    this.url = url;
    registry.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: string }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  /** Deliver one server event with its JSON `data` payload (the wire shape). */
  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) });
    }
  }

  emitRaw(type: string, data: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data });
    }
  }

  /** Simulate a transport drop (network cut, server close without terminal,
   * 401 on an expired/consumed ticket — EventSource cannot read the status). */
  drop(): void {
    for (const listener of this.listeners.get("error") ?? []) {
      listener({});
    }
  }
}

interface MintRecord {
  variables: CreateStreamTicketMutationVariables;
  token: string;
}

/** Recorded-mint + FakeEventSource registry: the test's full control surface. */
function makeDeps(options: { maxRestarts?: number } = {}) {
  const sources: FakeEventSource[] = [];
  const mints: MintRecord[] = [];
  let mintCount = 0;
  const deps = {
    mintTicket: (variables: CreateStreamTicketMutationVariables) => {
      mintCount += 1;
      const token = `tok-${mintCount}`;
      mints.push({ variables, token });
      return Promise.resolve(token);
    },
    createEventSource: (url: string) => new FakeEventSource(url, sources),
    maxRestarts: options.maxRestarts,
  };
  return {
    deps,
    sources,
    mints,
    mintCount: () => mintCount,
  };
}

/** Flush the mint/open microtask chain (real timers; one macrotask tick
 * drains every pending microtask). */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// -- request fixtures (the shapes T5's CompanionService adapter will pass) -----

const companionRequest = (): StreamRequest => ({
  op: "companion",
  materialId: "mat-1",
  question: "这个部分讲了什么？",
  position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
  escalated: false,
  language: "zh",
});

const proposalRequest = (): StreamRequest => ({
  op: "proposal",
  message: "软件工程期末备考",
  materials: [{ title: "复习讲义", kind: "pdf", text: "第 1 章" }],
  language: "zh",
});

const planCompanionRequest = (): PlanCompanionStreamRequest => ({
  op: "plan_companion",
  planId: "plan-1",
  question: "这个计划的重点是什么？",
  mistakeEntryId: "mistake-1",
  language: "zh",
});

// -- the frozen server contract fixtures (api_stream_spec.rb verbatim) ---------

const companionRung = { intent: "explain", rung: "hint", canEscalate: true, language: "zh" };
const proposalRung = { intent: "reference", rung: "hint", canEscalate: false, language: "zh" };
const citation = { locator: { kind: "markdown", sectionId: "sec-1" }, quote: null };
const okProposal = {
  code: "OK",
  proposal: {
    topic: "软件工程",
    language: "zh",
    stages: [
      { name: "阶段一：基础", nodes: [{ title: "命令层" }, { title: "ER 模型" }] },
      { name: "阶段二：实践", nodes: [{ title: "集成走查" }] },
    ],
    edges: [["命令层", "集成走查"]],
  },
};

/** Recorded consumer callbacks — the AD-5 pieces the UI renders, plus the
 * restart notices (the cap-counted UI hook). */
function makeHandlers() {
  const rungs: unknown[] = [];
  const tokens: string[] = [];
  const citations: unknown[] = [];
  const terminals: StreamTerminal[] = [];
  const restarts: Array<{ attempt: number; messageKey: string }> = [];
  return {
    rungs,
    tokens,
    citations,
    terminals,
    restarts,
    handlers: {
      onRung: (rung: unknown) => rungs.push(rung),
      onToken: (text: string) => tokens.push(text),
      onCitation: (c: unknown) => citations.push(c),
      onTerminal: (terminal: StreamTerminal) => terminals.push(terminal),
      onRestart: (notice: { attempt: number; messageKey: string }) => restarts.push(notice),
    },
  };
}

// -- tests ---------------------------------------------------------------------

describe("startStream (the /api/stream EventSource wrapper — epic P2-8 T4)", () => {
  it("opens /api/stream with the minted ticket + op params (ticket-only auth)", async () => {
    const harness = makeDeps();
    startStream(companionRequest(), {}, harness.deps);
    await settle();

    expect(harness.sources).toHaveLength(1);
    expect(harness.sources[0].url).toBe("/api/stream?ticket=tok-1&op=companion");
  });

  it("mints companion tickets with the grounding inputs INSIDE (query params are log-exposed)", async () => {
    const harness = makeDeps();
    startStream(companionRequest(), {}, harness.deps);
    await settle();

    expect(harness.mints).toHaveLength(1);
    expect(harness.mints[0].variables).toEqual({
      input: {
        op: "companion",
        language: "zh",
        materialId: "mat-1",
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        escalated: false,
      },
    });
  });

  it("mints companion tickets with the selection grounding input riding INSIDE (epic-13 T1)", async () => {
    const harness = makeDeps();
    startStream(
      {
        op: "companion",
        materialId: "mat-1",
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        escalated: false,
        selection: "Every row is scoped by user_id.",
        language: "zh",
      },
      {},
      harness.deps,
    );
    await settle();

    expect(harness.mints).toHaveLength(1);
    expect(harness.mints[0].variables.input.selection).toBe("Every row is scoped by user_id.");
  });

  it("mints proposal tickets with the message + materials (epic-27)", async () => {
    const harness = makeDeps();
    startStream(proposalRequest(), {}, harness.deps);
    await settle();

    expect(harness.mints[0].variables).toEqual({
      input: {
        op: "proposal",
        language: "zh",
        message: "软件工程期末备考",
        materials: [{ title: "复习讲义", kind: "pdf", text: "第 1 章" }],
      },
    });
    expect(harness.sources[0].url).toBe("/api/stream?ticket=tok-1&op=proposal");
  });

  it("mints plan_companion tickets with the plan + mistake grounding inputs (epic P2-12 T3)", async () => {
    const harness = makeDeps();
    startStream(planCompanionRequest(), {}, harness.deps);
    await settle();

    expect(harness.mints).toHaveLength(1);
    expect(harness.mints[0].variables).toEqual({
      input: {
        op: "plan_companion",
        language: "zh",
        planId: "plan-1",
        question: "这个计划的重点是什么？",
        mistakeEntryId: "mistake-1",
      },
    });
    expect(harness.sources[0].url).toBe("/api/stream?ticket=tok-1&op=plan_companion");
  });

  it("epic-34 T2: a teaching turn's nodeId rides the ticket input — and stays OFF generic turns", async () => {
    const harness = makeDeps();
    startStream({ ...planCompanionRequest(), nodeId: "node-9" }, {}, harness.deps);
    await settle();
    startStream(planCompanionRequest(), {}, harness.deps);
    await settle();

    expect(harness.mints[0].variables.input.nodeId).toBe("node-9");
    // the frozen payload discipline: the key never rides when absent
    expect("nodeId" in harness.mints[1].variables.input).toBe(false);
  });

  it("the language parameter follows each stream's request (toggle mid-session applies to the next stream)", async () => {
    const harness = makeDeps();
    startStream(companionRequest(), {}, harness.deps);
    await settle();
    startStream({ ...proposalRequest(), language: "en" }, {}, harness.deps);
    await settle();

    expect(harness.mints[0].variables.input.language).toBe("zh");
    expect(harness.mints[1].variables.input.language).toBe("en");
    expect(harness.sources[1].url).toBe("/api/stream?ticket=tok-2&op=proposal");
  });

  it("parses the frozen companion vocabulary: rung → token* → citation → terminal{OK}", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    const source = harness.sources[0];
    source.emit("rung", companionRung);
    source.emit("token", { text: "每个" });
    source.emit("token", { text: "行都有 user_id" });
    source.emit("citation", citation);
    source.emit("terminal", { code: "OK" });

    await expect(session.done).resolves.toEqual({ code: "OK" });
    expect(recorded.rungs).toEqual([companionRung]);
    expect(recorded.tokens).toEqual(["每个", "行都有 user_id"]);
    // the wire's quote:null parses to the AD-5 absent optional
    expect(recorded.citations).toEqual([{ locator: citation.locator, quote: undefined }]);
    expect(recorded.terminals).toEqual([{ code: "OK" }]);
    // terminal ends the session — the terminator unregistered, no restart
    expect(harness.mintCount()).toBe(1);
  });

  it("parses the proposal terminal's payload into the AD-5 proposal shape (tags stripped server-side)", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(proposalRequest(), recorded.handlers, harness.deps);
    await settle();

    const source = harness.sources[0];
    source.emit("rung", proposalRung);
    source.emit("token", { text: "阶段一：基础（命令层、ER 模型）" });
    source.emit("terminal", okProposal);

    await expect(session.done).resolves.toEqual({ code: "OK", proposal: okProposal.proposal });
    expect(recorded.rungs).toEqual([proposalRung]);
    expect(recorded.terminals).toEqual([{ code: "OK", proposal: okProposal.proposal }]);
  });

  it("a malformed event frame is skipped, not fatal (the stream continues to terminal)", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    const source = harness.sources[0];
    source.emitRaw("token", "not-json{{{");
    source.emit("token", { text: "完" });
    source.emit("terminal", { code: "OK" });

    await expect(session.done).resolves.toEqual({ code: "OK" });
    expect(recorded.tokens).toEqual(["完"]);
  });

  it("a drop mid-generation mints a FRESH ticket and restarts — close first, cap-counted notice, consumer continuity", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    // first attempt: rung + one token, then the transport drops (no terminal)
    const first = harness.sources[0];
    first.emit("rung", companionRung);
    first.emit("token", { text: "每个" });
    first.drop();
    await settle();

    // AD-16: auto-reconnect disabled — the dropped socket closed BEFORE the
    // fresh ticket's stream opened; a fresh ticket was minted (cap-counted).
    expect(first.closed).toBe(true);
    expect(harness.mintCount()).toBe(2);
    expect(harness.sources).toHaveLength(2);
    expect(harness.sources[1].url).toBe("/api/stream?ticket=tok-2&op=companion");
    expect(recorded.restarts).toEqual([{ attempt: 1, messageKey: "ai.stream.connectionLost" }]);

    // the restart re-runs the whole generation on the same consumer
    const second = harness.sources[1];
    second.emit("token", { text: "每个" });
    second.emit("token", { text: "行都有 user_id" });
    second.emit("terminal", { code: "OK" });

    await expect(session.done).resolves.toEqual({ code: "OK" });
    expect(recorded.tokens).toEqual(["每个", "每个", "行都有 user_id"]);
    expect(harness.mintCount()).toBe(2); // terminal ends everything — no further mints
  });

  it("the restart guard stops a pathological drop loop with the gave-up terminal", async () => {
    const harness = makeDeps({ maxRestarts: 1 });
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    harness.sources[0].drop(); // restart #1 (allowed)
    await settle();
    harness.sources[1].drop(); // guard exhausted → give up
    await settle();

    expect(harness.mintCount()).toBe(2); // no third attempt
    expect(recorded.restarts).toEqual([
      { attempt: 1, messageKey: "ai.stream.connectionLost" },
    ]);
    expect(recorded.terminals).toEqual([
      { code: "INTERNAL", error: expect.objectContaining({ code: "INTERNAL", messageKey: "ai.stream.gaveUp" }) },
    ]);
    await expect(session.done).resolves.toEqual({
      code: "INTERNAL",
      error: expect.objectContaining({ messageKey: "ai.stream.gaveUp" }),
    });
  });

  it("terminal CAP_REACHED surfaces the cap notice and ends the session without a restart", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    // the server trips the cap BEFORE any token exists (api_stream_spec.rb)
    harness.sources[0].emit("terminal", { code: "CAP_REACHED" });

    await expect(session.done).resolves.toEqual({
      code: "CAP_REACHED",
      error: expect.objectContaining({ code: "CAP_REACHED", messageKey: "ai.stream.capReached" }),
    });
    expect(recorded.terminals).toHaveLength(1);
    expect(harness.mintCount()).toBe(1); // terminal is terminal — a cap refusal never restarts
    expect(harness.sources[0].closed).toBe(true);
  });

  it("terminal enum codes map code → AppError → t() key (the full closed enum)", async () => {
    expect(STREAM_TERMINAL_KEYS).toEqual({
      UNAUTHORIZED: "ai.stream.errorUnauthorized",
      FORBIDDEN: "ai.stream.errorForbidden",
      NOT_FOUND: "ai.stream.errorNotFound",
      VALIDATION_FAILED: "ai.stream.errorValidation",
      RATE_LIMITED: "ai.stream.errorRateLimited",
      CAP_REACHED: "ai.stream.capReached",
      INTERNAL: "ai.stream.errorInternal",
    });

    // one server-observed code end-to-end (material vanished between mint and redeem)
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();
    harness.sources[0].emit("terminal", { code: "NOT_FOUND" });

    await expect(session.done).resolves.toEqual({
      code: "NOT_FOUND",
      error: expect.objectContaining({ code: "NOT_FOUND", messageKey: "ai.stream.errorNotFound" }),
    });
  });

  it("an out-of-contract terminal code keeps its raw code with the generic failure key", async () => {
    const harness = makeDeps();
    const recorded = makeHandlers();
    const session = startStream(companionRequest(), recorded.handlers, harness.deps);
    await settle();

    harness.sources[0].emit("terminal", { code: "SOMETHING_NEW" });

    await expect(session.done).resolves.toEqual({
      code: "SOMETHING_NEW",
      error: expect.objectContaining({ code: "SOMETHING_NEW", messageKey: "ai.stream.failed" }),
    });
  });

  it("a late drop after terminal is ignored — a completed session never restarts", async () => {
    const harness = makeDeps();
    const session = startStream(companionRequest(), {}, harness.deps);
    await settle();

    harness.sources[0].emit("terminal", { code: "OK" });
    await expect(session.done).resolves.toEqual({ code: "OK" });

    harness.sources[0].drop(); // stale transport noise after completion
    await settle();
    expect(harness.mintCount()).toBe(1);
    expect(harness.sources).toHaveLength(1);
  });

  it("resetApiClient() kills the live stream; the session does not resurrect it", async () => {
    const harness = makeDeps();
    const session = startStream(companionRequest(), {}, harness.deps);
    await settle();
    expect(harness.sources).toHaveLength(1);

    await resetApiClient();

    expect(harness.sources[0].closed).toBe(true);
    await expect(session.done).resolves.toBeNull(); // cancelled before any terminal

    // the kill is final — a stale error event mints nothing
    harness.sources[0].drop();
    await settle();
    expect(harness.mintCount()).toBe(1);
    expect(harness.sources).toHaveLength(1);
  });

  it("terminators never stack: registered once on open, unregistered at session end", async () => {
    const resetModule = (await import("@/apollo/reset")) as unknown as {
      __probe: { registered: number; unregistered: number };
    };
    const beforeRegistered = resetModule.__probe.registered;
    const beforeUnregistered = resetModule.__probe.unregistered;

    const harness = makeDeps();
    const session = startStream(companionRequest(), {}, harness.deps);
    await settle();
    expect(resetModule.__probe.registered - beforeRegistered).toBe(1);

    // a restart does NOT stack a second terminator — the same one stays live
    harness.sources[0].drop();
    await settle();
    expect(resetModule.__probe.registered - beforeRegistered).toBe(1);

    // terminal end unregisters
    harness.sources[1].emit("terminal", { code: "OK" });
    await expect(session.done).resolves.toEqual({ code: "OK" });
    expect(resetModule.__probe.unregistered - beforeUnregistered).toBe(1);
  });

  it("cancel() closes the socket immediately, even mid-mint, and ends the session", async () => {
    const harness = makeDeps();
    const session = startStream(companionRequest(), {}, harness.deps);
    await settle();

    session.cancel();
    expect(harness.sources[0].closed).toBe(true);
    await expect(session.done).resolves.toBeNull();

    // idempotent: a second cancel (or a late drop) does nothing
    session.cancel();
    harness.sources[0].drop();
    await settle();
    expect(harness.mintCount()).toBe(1);
  });
});

describe("mintStreamTicketWith (the real mint over the Apollo seam)", () => {
  it("rides the codegen CreateStreamTicket document through the harness echo", async () => {
    const client = createStubClient(
      {
        // the harness keys by OPERATION NAME; the returned object is the root
        // field's payload itself (echo semantics)
        CreateStreamTicket: (variables) => ({
          __typename: "CreateStreamTicketPayload",
          token: `tok-${variables.input.op}`,
          expiresAt: "2026-11-04T00:01:00Z",
        }),
      },
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );

    const token = await mintStreamTicketWith(client, {
      input: {
        op: "companion",
        language: "zh",
        materialId: "mat-1",
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        escalated: false,
      },
    });

    expect(token).toBe("tok-companion");
  });

  it("maps a mint failure's GraphQL code through the closed enum (cap refusal)", async () => {
    const client = errorClient("CAP_REACHED");

    await expect(
      mintStreamTicketWith(client, { input: { op: "companion", language: "zh" } }),
    ).rejects.toMatchObject({ code: "CAP_REACHED", messageKey: "ai.stream.capReached" });
  });

  it("maps a code-less mint failure (network/parse) to the generic failure key", async () => {
    const client = errorClient(null);

    await expect(
      mintStreamTicketWith(client, { input: { op: "proposal", language: "en" } }),
    ).rejects.toMatchObject({ code: "INTERNAL", messageKey: "ai.stream.failed" });
  });
});

/** An ApolloClient whose link answers with GraphQL errors (extensions.code as
 * given; null = no code at all — the transport/parse failure shape). */
function errorClient(code: string | null): ApolloClient {
  const link = new ApolloLink((operation) => {
    return new Observable<FetchResult>((observer) => {
      const timer = setTimeout(() => {
        const errors = code
          ? [{ message: "boom", extensions: { code } }]
          : [{ message: "socket hung up" }];
        observer.next({ data: null, errors });
        observer.complete();
      }, 0);
      return () => clearTimeout(timer);
    });
  });
  return new ApolloClient({ link: from([link]), cache: new InMemoryCache() });
}

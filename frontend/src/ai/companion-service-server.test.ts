/**
 * The CompanionService server adapter tests (epic P2-8 T5) — deterministic,
 * offline, no server. The same two fakes as sse-client.test.ts drive the
 * stream half: a recorded-mint function and a FakeEventSource emitting the
 * FROZEN server contract (backend/spec/requests/api_stream_spec.rb). The
 * mutation half rides the stub-GraphQL harness (src/test/apollo-harness.tsx,
 * echo semantics) plus the errorClient link for the closed-enum mapping.
 *
 * Pinned here: the seam shapes that cross the wire (the grounding inputs ride
 * INSIDE the ticket; the quiz generation carries clientUuid + language + the
 * plan/task scope and NO sections; grading carries questionId), the code →
 * AppError → t() key maps (AD-9/AD-12), and the honest guards (no materialId →
 * no mint; no questionId → no local grading fallback, AD-14).
 */
import { ApolloClient, ApolloLink, InMemoryCache, from } from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import { Observable } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { createStubClient } from "@/test/apollo-harness";
import { AppError } from "@/lib/app-error";
import { AI_MUTATION_KEYS, ServerCompanionService } from "./companion-service-server";
import type { StreamDeps, StreamEventSourceLike } from "./sse-client";
import type { CompanionReply, PlanStructureProposal } from "./types";

// -- the fake EventSource + dependency harness (sse-client.test.ts patterns) ----

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

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) });
    }
  }

  drop(): void {
    for (const listener of this.listeners.get("error") ?? []) {
      listener({});
    }
  }
}

/** Recorded-mint + FakeEventSource registry: the stream tests' control surface. */
function makeDeps(): { deps: StreamDeps; sources: FakeEventSource[]; mints: unknown[] } {
  const sources: FakeEventSource[] = [];
  const mints: unknown[] = [];
  let mintCount = 0;
  const deps: StreamDeps = {
    mintTicket: (variables) => {
      mintCount += 1;
      mints.push(variables);
      return Promise.resolve(`tok-${mintCount}`);
    },
    createEventSource: (url) => new FakeEventSource(url, sources),
  };
  return { deps, sources, mints };
}

/** Flush the mint/open microtask chain (real timers; one macrotask tick
 * drains every pending microtask). */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// -- fixtures (the frozen server contract, api_stream_spec.rb vocabulary) ------

const rungEvent = { intent: "explain", rung: "hint", canEscalate: true, language: "zh" };

// -- construction ---------------------------------------------------------------

/** The adapter under test: stream deps injected, mutations over a client. */
function makeAdapter(options: { client?: ApolloClient; deps?: StreamDeps } = {}) {
  return new ServerCompanionService(options);
}

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

// -- tests ---------------------------------------------------------------------

describe("ServerCompanionService — planChat (the plan_companion stream, epic P2-12 T3)", () => {
  it("mints the plan grounding inputs INSIDE the ticket and streams the reply tokens", async () => {
    const { deps, sources, mints } = makeDeps();
    const adapter = makeAdapter({ deps });
    const tokens: string[] = [];

    const replyPromise = adapter.planChat(
      { planId: "plan-1", question: "这个计划的重点是什么？", language: "zh" },
      (chunk) => tokens.push(chunk),
    );
    await settle();

    expect(mints).toHaveLength(1);
    expect(mints[0]).toEqual({
      input: {
        op: "plan_companion",
        language: "zh",
        planId: "plan-1",
        question: "这个计划的重点是什么？",
        mistakeEntryId: undefined,
      },
    });

    sources[0].emit("rung", { intent: "explain", rung: "hint", canEscalate: false, language: "zh" });
    sources[0].emit("token", { text: "先看" });
    sources[0].emit("token", { text: "节点层" });
    sources[0].emit("terminal", { code: "OK" });

    const reply: CompanionReply = await replyPromise;
    expect(reply).toEqual({
      intent: "explain",
      rung: "hint",
      text: "先看节点层",
      citations: [],
      canEscalate: false,
      language: "zh",
    });
    expect(tokens).toEqual(["先看", "节点层"]);
  });

  it("carries the mistake entry id on the mint and its citation onto the reply (the grounded turn)", async () => {
    const { deps, sources, mints } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.planChat({
      planId: "plan-1",
      question: "解释错误",
      language: "en",
      mistakeEntryId: "mistake-9",
    });
    await settle();
    expect(mints[0]).toMatchObject({
      input: { op: "plan_companion", mistakeEntryId: "mistake-9", language: "en" },
    });

    sources[0].emit("rung", { intent: "explain", rung: "hint", canEscalate: false, language: "en" });
    sources[0].emit("token", { text: "the assumption you skipped" });
    sources[0].emit("citation", { locator: { kind: "pdf", page: 3 }, quote: null });
    sources[0].emit("terminal", { code: "OK" });

    const reply = await replyPromise;
    expect(reply.citations).toEqual([{ locator: { kind: "pdf", page: 3 }, quote: undefined }]);
    expect(reply.canEscalate).toBe(false);
  });

  it("a failed plan stream rejects with the terminal's AppError (the driver's failure path)", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.planChat({ planId: "plan-1", question: "q", language: "zh" });
    await settle();
    sources[0].emit("terminal", { code: "NOT_FOUND" });

    await expect(replyPromise).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("ServerCompanionService — chat (the companion stream via T4)", () => {
  it("mints the grounding inputs INSIDE the ticket and streams the reply tokens", async () => {
    const { deps, sources, mints } = makeDeps();
    const adapter = makeAdapter({ deps });
    const tokens: string[] = [];

    const replyPromise = adapter.chat(
      {
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        language: "zh",
        materialId: "mat-1",
      },
      (chunk) => tokens.push(chunk),
    );
    await settle();

    expect(mints).toHaveLength(1);
    expect(mints[0]).toEqual({
      input: {
        op: "companion",
        language: "zh",
        materialId: "mat-1",
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        escalated: false,
      },
    });

    const source = sources[0];
    source.emit("rung", rungEvent);
    source.emit("token", { text: "每个" });
    source.emit("token", { text: "行都有 user_id" });
    source.emit("citation", { locator: { kind: "markdown", sectionId: "sec-1" }, quote: null });
    source.emit("terminal", { code: "OK" });

    const reply: CompanionReply = await replyPromise;
    expect(reply).toEqual({
      intent: "explain",
      rung: "hint",
      text: "每个行都有 user_id",
      citations: [{ locator: { kind: "markdown", sectionId: "sec-1" }, quote: undefined }],
      canEscalate: true,
      language: "zh",
    });
    expect(tokens).toEqual(["每个", "行都有 user_id"]); // progressive emission rode through
  });

  it("the escalation flag rides to the mint verbatim (the ladder is server-derived)", async () => {
    const { deps, sources, mints } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.chat({
      question: "直接告诉我",
      position: { locator: { kind: "pdf", page: 3 }, text: "current view" },
      language: "en",
      materialId: "mat-1",
      escalated: true,
    });
    await settle();
    expect(mints[0]).toMatchObject({ input: { escalated: true, language: "en" } });

    sources[0].emit("rung", { intent: "direct", rung: "answer", canEscalate: false, language: "en" });
    sources[0].emit("terminal", { code: "OK" });
    const reply = await replyPromise;
    expect(reply.rung).toBe("answer"); // the rung event is the server's word
    expect(reply.citations).toEqual([]);
  });

  it("a failure terminal rejects with the mapped AppError (never a server string)", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.chat({
      question: "问题",
      position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "t" },
      language: "zh",
      materialId: "mat-1",
    });
    await settle();
    sources[0].emit("terminal", { code: "CAP_REACHED" });

    await expect(replyPromise).rejects.toMatchObject({
      code: "CAP_REACHED",
      messageKey: "ai.stream.capReached",
    });
  });

  it("no materialId → no mint, a VALIDATION_FAILED refusal (the stream has no honest target)", async () => {
    const { deps, mints } = makeDeps();
    const adapter = makeAdapter({ deps });

    await expect(
      adapter.chat({
        question: "问题",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "t" },
        language: "zh",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", messageKey: "ai.generate.errorValidation" });
    expect(mints).toHaveLength(0);
  });

  it("cancellation (resetApiClient mid-stream) rejects — no reply is built from nothing", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.chat({
      question: "问题",
      position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "t" },
      language: "zh",
      materialId: "mat-1",
    });
    await settle();
    sources[0].emit("token", { text: "半截" });

    const { resetApiClient } = await import("@/apollo/reset");
    await resetApiClient();

    await expect(replyPromise).rejects.toBeInstanceOf(AppError);
    await expect(replyPromise).rejects.toMatchObject({ messageKey: "ai.stream.failed" });
  });
});

describe("ServerCompanionService — generatePlanStructure (the proposal stream)", () => {
  it("streams the tokens and resolves the terminal's proposal payload", async () => {
    const { deps, sources, mints } = makeDeps();
    const adapter = makeAdapter({ deps });
    const tokens: string[] = [];
    const proposal: PlanStructureProposal = {
      topic: "软件工程",
      language: "zh",
      stages: [{ name: "阶段一：基础", nodes: [{ title: "命令层" }, { title: "ER 模型" }] }],
      edges: [],
    };

    const proposalPromise = adapter.generatePlanStructure(
      "备考 COMP5241，我先啃讲义",
      [{ title: "复习讲义", kind: "pdf", text: "第 1 章 集成测试" }],
      "zh",
      (chunk) => tokens.push(chunk),
    );
    await settle();

    // the message + the materials ride the ticket (epic-27: the creation
    // chat's generation inputs); tags are stripped server-side
    expect(mints[0]).toEqual({
      input: {
        op: "proposal",
        language: "zh",
        message: "备考 COMP5241，我先啃讲义",
        materials: [{ title: "复习讲义", kind: "pdf", text: "第 1 章 集成测试" }],
      },
    });

    sources[0].emit("token", { text: "阶段一：基础" });
    sources[0].emit("terminal", { code: "OK", proposal });

    expect(await proposalPromise).toEqual(proposal);
    expect(tokens).toEqual(["阶段一：基础"]);
  });

  it("a proposal failure terminal rejects with the mapped AppError", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });

    const proposalPromise = adapter.generatePlanStructure("软件工程", [], "en");
    await settle();
    sources[0].emit("terminal", { code: "RATE_LIMITED" });

    await expect(proposalPromise).rejects.toMatchObject({
      code: "RATE_LIMITED",
      messageKey: "ai.stream.errorRateLimited",
    });
  });
});

describe("ServerCompanionService — generateQuiz (the mutation half)", () => {
  /** The stub client echoing a server-shaped GenerateQuiz payload. */
  function quizClient(recorded: { variables?: unknown } = {}): ApolloClient {
    return createStubClient(
      {
        GenerateQuiz: (variables) => {
          recorded.variables = variables;
          return {
            questions: [
              {
                __typename: "Question",
                id: "q-1",
                sessionId: "session-1",
                nodeId: "node-a",
                kind: "open",
                prompt: "解释集成测试的目的。",
                options: null,
                correctOptionIndex: null,
                sourceMaterialId: "mat-1",
                sourceSectionId: "sec-1",
                keywords: ["集成测试", "交互"],
                explanation: "集成测试验证组件之间的交互。",
              },
              {
                __typename: "Question",
                id: "q-2",
                sessionId: "session-1",
                nodeId: "node-b",
                kind: "choice",
                prompt: "哪一层负责用户身份?",
                options: ["命令层", "ER 层"],
                correctOptionIndex: 0,
                sourceMaterialId: "mat-1",
                sourceSectionId: "sec-2",
                keywords: null,
                explanation: "命令层负责身份验证。",
              },
            ],
          };
        },
      },
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
  }

  it("generates SERVER-SIDE: clientUuid replay key + language + scope, no sections on the wire", async () => {
    const recorded: { variables?: unknown } = {};
    const adapter = makeAdapter({ client: quizClient(recorded) });

    const questions = await adapter.generateQuiz({
      materials: [{ materialId: "mat-1", sections: [{ id: "sec-1", title: "s", text: "t" }] }],
      nodeIds: ["node-a"],
      mode: "mix",
      planId: "plan-1",
      taskId: null,
    });

    const input = (recorded.variables as { input: Record<string, unknown> }).input;
    expect(input.mode).toBe("mix");
    expect(input.language).toBe("zh"); // the UI mirror, not a caller param
    expect(input.planId).toBe("plan-1");
    expect(input.taskId).toBeUndefined(); // xor scope — the absent side is not sent
    expect(typeof input.clientUuid).toBe("string");
    expect((input.clientUuid as string)).toMatch(/^[0-9a-f-]{36}$/); // the replay key (delta 3)
    expect(JSON.stringify(recorded.variables)).not.toContain("sections"); // the wire carries no sections

    // server questions map onto the seam's GeneratedQuestion in order
    expect(questions).toEqual([
      {
        prompt: "解释集成测试的目的。",
        nodeId: "node-a",
        kind: "open",
        options: undefined,
        correctOptionIndex: undefined,
        sourceMaterialId: "mat-1",
        sourceSectionId: "sec-1",
        keywords: ["集成测试", "交互"],
        explanation: "集成测试验证组件之间的交互。",
      },
      {
        prompt: "哪一层负责用户身份?",
        nodeId: "node-b",
        kind: "choice",
        options: ["命令层", "ER 层"],
        correctOptionIndex: 0,
        sourceMaterialId: "mat-1",
        sourceSectionId: "sec-2",
        keywords: undefined,
        explanation: "命令层负责身份验证。",
      },
    ]);
  });

  it("a task-scope generation carries taskId (AD-6 ownership: exactly one side)", async () => {
    const recorded: { variables?: unknown } = {};
    const adapter = makeAdapter({ client: quizClient(recorded) });

    await adapter.generateQuiz({ materials: [], nodeIds: [], mode: "open", planId: null, taskId: "task-9" });

    const input = (recorded.variables as { input: Record<string, unknown> }).input;
    expect(input.taskId).toBe("task-9");
    expect(input.planId).toBeUndefined();
  });

  it("the targeting input rides the wire (T5: the node Quick Test scope, FR-21)", async () => {
    const recorded: { variables?: unknown } = {};
    const adapter = makeAdapter({ client: quizClient(recorded) });

    await adapter.generateQuiz({
      materials: [],
      nodeIds: [],
      mode: "open",
      planId: null,
      taskId: null,
      targeting: { nodeId: "node-a" },
    });

    const input = (recorded.variables as { input: Record<string, unknown> }).input;
    expect(input.targeting).toEqual({ nodeId: "node-a" });
    expect(input.planId).toBeUndefined(); // the xor scope: the node IS the scope on the wire
  });

  it("no targeting → the field is not sent (today's plan/task quiz unchanged)", async () => {
    const recorded: { variables?: unknown } = {};
    const adapter = makeAdapter({ client: quizClient(recorded) });

    await adapter.generateQuiz({ materials: [], nodeIds: [], mode: "open", planId: "plan-1" });

    const input = (recorded.variables as { input: Record<string, unknown> }).input;
    expect(input.targeting).toBeUndefined();
  });

  it("maps a GraphQL failure through the closed enum (cap refusal on generation)", async () => {
    const adapter = makeAdapter({ client: errorClient("CAP_REACHED") });

    await expect(
      adapter.generateQuiz({ materials: [], nodeIds: [], mode: "open", planId: "plan-1" }),
    ).rejects.toMatchObject({ code: "CAP_REACHED", messageKey: "ai.generate.capReached" });
  });

  it("maps a code-less failure (network/parse) to the generic generation-failure key", async () => {
    const adapter = makeAdapter({ client: errorClient(null) });

    await expect(
      adapter.generateQuiz({ materials: [], nodeIds: [], mode: "open", planId: "plan-1" }),
    ).rejects.toMatchObject({ code: "INTERNAL", messageKey: "ai.generate.failed" });
  });
});

describe("ServerCompanionService — generateFlashcards (one mutation per material)", () => {
  it("walks the materials in order and concatenates their decks (the driver slices by section count)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createStubClient(
      {
        GenerateFlashcards: (variables) => {
          calls.push(variables);
          const materialId = (variables as { input: { materialId: string } }).input.materialId;
          return {
            cards:
              materialId === "mat-1"
                ? [{ front: "集成测试?", back: "验证组件交互" }, { front: "ER 模型?", back: "实体关系" }]
                : [{ front: "命令层?", back: "发起一切请求" }],
          };
        },
      },
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const adapter = makeAdapter({ client });

    const cards = await adapter.generateFlashcards({
      materials: [
        { materialId: "mat-1", sections: [{ id: "s1", title: "", text: "" }, { id: "s2", title: "", text: "" }] },
        { materialId: "mat-2", sections: [{ id: "s3", title: "", text: "" }] },
      ],
    });

    expect(calls.map((c) => (c as { input: { materialId: string } }).input.materialId)).toEqual(["mat-1", "mat-2"]);
    expect(calls[0]).toMatchObject({ input: { language: "zh" } });
    expect(cards).toEqual([
      { front: "集成测试?", back: "验证组件交互" },
      { front: "ER 模型?", back: "实体关系" },
      { front: "命令层?", back: "发起一切请求" },
    ]);
  });

  it("no materials → no mutation (an honest empty deck)", async () => {
    const handler = vi.fn();
    const client = createStubClient({ GenerateFlashcards: handler }, { sessions: [], evidence: [], mistakes: [], plans: [] });
    const adapter = makeAdapter({ client });

    expect(await adapter.generateFlashcards({ materials: [] })).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps a NOT_FOUND material refusal through the closed enum", async () => {
    const adapter = makeAdapter({ client: errorClient("NOT_FOUND") });

    await expect(
      adapter.generateFlashcards({ materials: [{ materialId: "mat-x", sections: [] }] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", messageKey: "ai.generate.errorNotFound" });
  });
});

describe("ServerCompanionService — gradeOpenAnswer (grading by questionId)", () => {
  it("sends questionId + answer + language; the server owns keywords/source (never on the wire)", async () => {
    const recorded: { variables?: unknown } = {};
    const client = createStubClient(
      {
        GradeOpenAnswer: (variables) => {
          recorded.variables = variables;
          return {
            gradedAnswer: {
              outcome: "partial",
              rationale: "答到了一半：关键词覆盖不全。",
              citation: { locator: { kind: "markdown", page: null, sectionId: "sec-1" }, quote: null },
            },
          };
        },
      },
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const adapter = makeAdapter({ client });

    const graded = await adapter.gradeOpenAnswer({
      keywords: ["ignored-by-server"],
      answer: "集成测试检查组件之间的协作。",
      sourceText: "ignored-by-server",
      source: { kind: "markdown", sectionId: "sec-1" },
      language: "zh",
      questionId: "q-1",
    });

    expect(recorded.variables).toEqual({
      input: { questionId: "q-1", answer: "集成测试检查组件之间的协作。", language: "zh" },
    });
    expect(graded).toEqual({
      outcome: "partial",
      rationale: "答到了一半：关键词覆盖不全。",
      citation: { locator: { kind: "markdown", sectionId: "sec-1" }, quote: undefined },
    });
  });

  it("no questionId → VALIDATION_FAILED without a mutation (no local grading fallback, AD-14)", async () => {
    const handler = vi.fn();
    const client = createStubClient({ GradeOpenAnswer: handler }, { sessions: [], evidence: [], mistakes: [], plans: [] });
    const adapter = makeAdapter({ client });

    await expect(
      adapter.gradeOpenAnswer({
        keywords: ["k"],
        answer: "答",
        sourceText: "源",
        source: { kind: "markdown", sectionId: "s" },
        language: "zh",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", messageKey: "ai.generate.errorValidation" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("an out-of-vocabulary outcome throws loud (the mapper convention)", async () => {
    const client = createStubClient(
      {
        GradeOpenAnswer: () => ({
          gradedAnswer: { outcome: "sort-of", rationale: "r", citation: null },
        }),
      },
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const adapter = makeAdapter({ client });

    await expect(
      adapter.gradeOpenAnswer({
        keywords: [],
        answer: "a",
        sourceText: "s",
        source: { kind: "markdown", sectionId: "s" },
        language: "en",
        questionId: "q-1",
      }),
    ).rejects.toThrow(/unknown grade outcome/);
  });

  it("maps a GraphQL failure through the closed enum", async () => {
    const adapter = makeAdapter({ client: errorClient("UNAUTHORIZED") });

    await expect(
      adapter.gradeOpenAnswer({
        keywords: [],
        answer: "a",
        sourceText: "s",
        source: { kind: "markdown", sectionId: "s" },
        language: "en",
        questionId: "q-1",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", messageKey: "ai.generate.errorUnauthorized" });
  });
});

describe("ServerCompanionService — the cap-counted restart notice (US2/AD-16 review fix)", () => {
  it("chat: a drop fires the seam's onNotice with the cap-counted t() key, then the restart completes", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });
    const notices: string[] = [];
    const tokens: string[] = [];

    const replyPromise = adapter.chat(
      {
        question: "这个部分讲了什么？",
        position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "current view" },
        language: "zh",
        materialId: "mat-1",
        onNotice: (key) => notices.push(key),
      },
      (chunk) => tokens.push(chunk),
    );
    await settle();

    sources[0].drop();
    await settle();
    // THE contract: the restart counted against the daily cap is never silent
    // — the wrapper's onRestart rides through as onNotice("ai.stream.connectionLost").
    expect(notices).toEqual(["ai.stream.connectionLost"]);

    // the stream continues on the fresh ticket — the notice is transient
    sources[1].emit("token", { text: "重连后" });
    sources[1].emit("terminal", { code: "OK" });
    const reply = await replyPromise;
    expect(reply.text).toBe("重连后");
    expect(tokens).toEqual(["重连后"]);
    expect(notices).toEqual(["ai.stream.connectionLost"]); // one drop, one notice
  });

  it("chat: onNotice stays optional — a drop still restarts cleanly without a listener", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });

    const replyPromise = adapter.chat({
      question: "问题",
      position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "t" },
      language: "zh",
      materialId: "mat-1",
    });
    await settle();
    sources[0].drop();
    await settle();
    sources[1].emit("terminal", { code: "OK" });

    await expect(replyPromise).resolves.toMatchObject({ text: "" }); // no crash, restart ran
  });

  it("generatePlanStructure: the proposal stream fires onNotice through the options object", async () => {
    const { deps, sources } = makeDeps();
    const adapter = makeAdapter({ deps });
    const notices: string[] = [];
    const proposal: PlanStructureProposal = {
      topic: "软件工程",
      language: "zh",
      stages: [{ name: "阶段一：基础", nodes: [{ title: "命令层" }] }],
      edges: [],
    };

    const proposalPromise = adapter.generatePlanStructure("软件工程", [], "zh", undefined, {
      onNotice: (key) => notices.push(key),
    });
    await settle();
    sources[0].drop();
    await settle();
    expect(notices).toEqual(["ai.stream.connectionLost"]);

    sources[1].emit("terminal", { code: "OK", proposal });
    expect(await proposalPromise).toEqual(proposal);
  });
});

describe("AI_MUTATION_KEYS (the mutation-path closed enum — AD-9/AD-12, 1:1)", () => {
  it("covers the FULL api enum with generation-flavored t() keys", () => {
    expect(AI_MUTATION_KEYS).toEqual({
      UNAUTHORIZED: "ai.generate.errorUnauthorized",
      FORBIDDEN: "ai.generate.errorForbidden",
      NOT_FOUND: "ai.generate.errorNotFound",
      VALIDATION_FAILED: "ai.generate.errorValidation",
      RATE_LIMITED: "ai.generate.errorRateLimited",
      CAP_REACHED: "ai.generate.capReached",
      INTERNAL: "ai.generate.errorInternal",
    });
  });
});

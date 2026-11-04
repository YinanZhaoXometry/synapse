/**
 * Epic-1 integration slice (T7), re-seated on the Apollo stub harness at the
 * cutover (epic P2-8): the spine's evidence-loop diagram walked across all
 * three seams — domain, api (typed hooks' documents over the echo server),
 * ai — in one pass, ending in a reload simulation. Expected values are worked
 * examples from ADR-0001. Prior art: use-quiz-session.test.tsx.
 *
 * The reload simulation is the server-world kind: localStorage is gone, so
 * "same storage, fresh in-memory world" becomes the SAME server state (the
 * harness handlers + captured rows) under a FRESH ApolloClient cache — reads
 * re-run the handlers and land everything the server kept, while a fresh
 * session-blob registry loses the bytes (the re-upload contract).
 */
import { describe, expect, it } from "vitest";
import { computeNodeScore, computePlanRollup, getNodeState } from "@/domain/mastery";
import { computeStreak } from "@/domain/streak";
import { mapEvidence } from "@/api/mappers";
import { createSessionBlobRegistry } from "@/lib/session-blobs";
import { createHarnessState, createStubClient, echoQuestion,
  echoTouchedNodes,
  echoTouchedPlan, type HarnessState, type EchoFixture } from "@/test/apollo-harness";
import {
  AllEvidenceDocument,
  AppendChatMessageDocument,
  AttachMaterialDocument,
  ChatThreadDocument,
  CreatePlanDocument,
  CreateQuizSessionDocument,
  ReadingProgressDocument,
  RecordEvidenceDocument,
  SaveReadingProgressDocument,
} from "@/types/graphql";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialSection, ReadingPosition } from "@/domain/entities";

const sections: MaterialSection[] = [
  { id: "page-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "page-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
  { id: "page-3", title: "Design principles", text: "SOLID keeps modules cohesive and decoupled." },
  { id: "page-4", title: "测试层级", text: "单元测试之后是集成测试，再是系统测试。" },
];

const CREATED = "2026-11-01T00:00:00Z";

describe("the evidence loop, end to end (plan → material → quiz → evidence → mastery)", () => {
  it("walks the spine's core data flow and lands on ADR-0001's exact numbers", async () => {
    // The echo server's rows: plans/nodes/materials are the reading progress +
    // chat persistence's server side; sessions/evidence/mistakes stay in the
    // harness state (the atomic recordEvidence batch's assertion surface).
    const server = {
      nodes: [] as EchoFixture[],
      materials: [] as EchoFixture[],
      progress: [] as EchoFixture[],
      threads: new Map<string, EchoFixture[]>(),
    };
    const state: HarnessState = createHarnessState();
/** The echo handlers widen the harness's object-only OperationHandler to the
 * wire-record EchoFixture: list roots return ARRAYS and handler inputs are the
 * server's own variable shapes — payloads stay structural, checked on read by
 * the mappers, never by the fixture types. */
type EchoHandler = (variables: EchoFixture, state: HarnessState) => unknown;

    const nodeRow = (row: EchoFixture) => ({
      ...row,
      // SERVER scores (AD-14): the echo derives them from the harness evidence
      // with the REAL domain functions — the stub plays by the api's rules.
      masteryScore: String(computeNodeScore(state.evidence.filter((e) => e.nodeId === row.id).map(mapEvidence), new Date())),
      state: getNodeState(state.evidence.filter((e) => e.nodeId === row.id).map(mapEvidence), new Date()),
    });
    const handlers: Record<string, EchoHandler> = {
      // 1. plan with two nodes — created through the real CreatePlan document
      CreatePlan: (variables) => {
        const input = variables.input as EchoFixture;
        const plan = { __typename: "StudyPlan", id: "plan-echo-1", topic: input.topic, goal: input.goal ?? null, createdAt: CREATED, masteryScore: "0" };
        const nodes = (input.nodes as EchoFixture[]).map((n, i) =>
          nodeRow({ __typename: "KnowledgeNode", id: `node-${i + 1}`, planId: plan.id, taskId: null, stage: n.stage ?? null, title: n.title, order: i, createdAt: CREATED }),
        );
        server.nodes.push(...nodes);
        return { plan, nodes };
      },
      // 2. material attach — the parse already landed (T2's entry contract:
      //    the eager parse's write-back), bytes parked session-only below
      AttachMaterial: (variables) => {
        const input = variables.input as EchoFixture;
        const material = {
          __typename: "Material",
          id: "m-echo-1",
          title: input.title,
          kind: input.kind,
          sizeBytes: input.sizeBytes,
          planId: input.planId ?? null,
          taskId: input.taskId ?? null,
          attachmentScope: "plan",
          nodeId: null,
          parseState: input.parseState ?? "pending",
          parseFailureReason: input.parseFailureReason ?? null,
          sections: (input.sections as EchoFixture[]).map((s) => ({ __typename: "MaterialSection", ...s })),
          createdAt: CREATED,
          downloadUrl: null, // presigns are minted per request, never persisted (epic P2-6)
        };
        server.materials.push(material);
        return { material };
      },
      CreateQuizSession: (variables) => {
        const input = variables.input as EchoFixture;
        const sessionId = `s-echo-${state.sessions.length + 1}`;
        const questions = (input.questions as EchoFixture[]).map((q, i) => echoQuestion(q, sessionId, i));
        const session = {
          __typename: "QuizSession",
          id: sessionId,
          planId: input.planId ?? null,
          taskId: input.taskId ?? null,
          mode: input.mode,
          status: "active",
          createdAt: CREATED,
          completedAt: null,
          questions, // stored for the echo's attribution lookups + the reload leg
        };
        state.sessions.push(session);
        return { session, questions };
      },
      // 4. the atomic batch: evidence + auto-mistakes + session completion in
      //    ONE echo — attribution derives from the stored question rows
      RecordEvidence: (variables) => {
        const input = variables.input as EchoFixture;
        const sessionId = input.sessionId as string;
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
          session.status = "completed";
          session.completedAt = CREATED;
        }
        const questionOf = (questionId: string) =>
          ((session?.questions as EchoFixture[]) ?? []).find((q) => q.id === questionId);
        const evidence = (input.results as EchoFixture[]).map((r, i) => ({
          __typename: "EvidenceRecord",
          id: `e-${sessionId}-${i}`,
          nodeId: questionOf(r.questionId)?.nodeId ?? "unattributed",
          sessionId,
          questionId: r.questionId,
          outcome: r.outcome,
          createdAt: new Date(Date.now() + i).toISOString(), // distinct — recency is real
        }));
        const mistakes = (input.results as EchoFixture[])
          .filter((r) => r.outcome === "wrong")
          .map((r, i) => {
            const sourceSectionId = (questionOf(r.questionId)?.sourceSectionId as string) ?? "";
            const page = /^page-(\d+)$/.exec(sourceSectionId);
            return {
              __typename: "MistakeEntry",
              id: `mist-${sessionId}-${i}`,
              questionId: r.questionId,
              sessionId,
              nodeId: questionOf(r.questionId)?.nodeId ?? "unattributed",
              userAnswer: r.userAnswer,
              sourceLocation: page
                ? { __typename: "ReadingLocator", kind: "pdf", page: Number(page[1]), sectionId: null }
                : { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: sourceSectionId || null },
              forfeited: r.forfeited,
              createdAt: CREATED,
            };
          });
        state.evidence.push(...evidence);
        state.mistakes.push(...mistakes);
        // The payload's live-update half (epic P2-10 T3) — fresh stub-computed
        // SERVER-shaped scores: full node history + the all-plan-nodes rollup.
        return {
          evidence,
          mistakes,
          session,
          nodes: echoTouchedNodes(state, evidence, (id) => server.nodes.find((n) => n.id === id)),
          plan: echoTouchedPlan(state, (session?.planId as string) ?? null, server.nodes),
        };
      },
      AllEvidence: () => state.evidence,
      SaveReadingProgress: (variables) => {
        const input = variables.input as EchoFixture;
        const row = {
          __typename: "ReadingProgress",
          id: `rp-${server.progress.length + 1}`,
          materialId: input.materialId,
          updatedAt: CREATED,
          position: { __typename: "ReadingPosition", text: input.position.text, locator: { __typename: "ReadingLocator", ...input.position.locator } },
        };
        server.progress = server.progress.filter((p) => p.materialId !== input.materialId);
        server.progress.push(row);
        return { readingProgress: row };
      },
      ReadingProgress: (variables) => server.progress.find((p) => p.materialId === variables.materialId) ?? null,
      AppendChatMessage: (variables) => {
        const input = variables.input as EchoFixture;
        const message = {
          __typename: "ChatMessage",
          id: `msg-${(server.threads.get(input.materialId as string) ?? []).length + 1}`,
          role: input.message.role,
          text: input.message.text,
          createdAt: CREATED,
          citations: (input.message.citations as EchoFixture[]).map((c) => ({ __typename: "ReadingLocator", ...c })),
        };
        const thread = server.threads.get(input.materialId as string) ?? [];
        thread.push(message);
        server.threads.set(input.materialId as string, thread);
        return { message };
      },
      ChatThread: (variables) => {
        const messages = server.threads.get(variables.materialId as string) ?? [];
        return { __typename: "ChatThread", id: `thread-${variables.materialId}`, materialId: variables.materialId, updatedAt: CREATED, messages };
      },
    };
    const client = createStubClient(handlers, state);
    const svc = getCompanionService();

    // 1. plan with two nodes
    const created = await client.mutate({ mutation: CreatePlanDocument, variables: { input: { clientUuid: crypto.randomUUID(), topic: "COMP5241 软件工程", goal: "exam prep", nodes: [{ title: "测试层级", stage: "测试与交付" }, { title: "需求工程", stage: "需求" }] } } });
    const nodes = created.data!.createPlan.nodes;
    const [nodeA, nodeB] = nodes;
    const planId = created.data!.createPlan.plan.id;

    // 2. material attach (blob session-only — the upload flow's tail)
    const blobs = createSessionBlobRegistry();
    blobs.put("m-echo-1", new Blob(["pdf-bytes"]));
    await client.mutate({ mutation: AttachMaterialDocument, variables: { input: { clientUuid: crypto.randomUUID(), title: "lecture-4.pdf", kind: "pdf", sizeBytes: 900, planId, taskId: null, sections, parseState: "parsed" } } });

    // 3. CompanionService generates a node-attributed Mix quiz from the material
    const questions = await svc.generateQuiz({
      materials: [{ materialId: "m-echo-1", sections }],
      nodeIds: [nodeA.id, nodeB.id],
      mode: "mix",
    });
    expect(questions).toHaveLength(8); // 4 sections × (choice + open), under the cap
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([nodeA.id, nodeB.id]));

    // 4. session + answers: A all-correct ×4; B correct + partial + forfeit
    const stored = await client.mutate({ mutation: CreateQuizSessionDocument, variables: { input: { clientUuid: crypto.randomUUID(), planId, taskId: null, mode: "mix", questions } } });
    const session = stored.data!.createQuizSession.session;
    const sessionQuestions = stored.data!.createQuizSession.questions;
    expect(session.planId).toBe(planId);
    const byNode = (id: string) => sessionQuestions.filter((q) => q.nodeId === id);
    const results = [
      ...byNode(nodeA.id).map((q) => ({ questionId: q.id, outcome: "correct", userAnswer: "picked", forfeited: false })),
      ...byNode(nodeB.id).map((q, i) =>
        i === 2
          ? { questionId: q.id, outcome: "wrong", userAnswer: "", forfeited: true }
          : i === 1
            ? { questionId: q.id, outcome: "partial", userAnswer: "half right", forfeited: false }
            : { questionId: q.id, outcome: "correct", userAnswer: "answered", forfeited: false },
      ),
    ];
    const recorded = await client.mutate({ mutation: RecordEvidenceDocument, variables: { input: { sessionId: session.id, results } } });

    // 5. mastery per ADR-0001 — worked example over the RETURNED evidence rows.
    //    The TS domain stays the anti-drift GOLDEN-VECTOR SOURCE (the mastery
    //    vectors regenerate from it); AD-14 only removed it from RENDER paths —
    //    the api's server scores are pinned to these exact functions.
    //    8 questions round-robin → A:4, B:4:
    //    A: 4 corrects → 100, gate met → mastered
    //    B: correct+partial+forfeit+correct → (1+0.5+0+1)/4 = 63, gate met → partial
    //    rollup = floor((100+63)/2) = 81 ; streak = today = 1
    //    (floor per ADR-0001 amendment 2026-11-04; half-up used to read 82)
    const evidence = recorded.data!.recordEvidence.evidence.map(mapEvidence);
    const evA = evidence.filter((e) => e.nodeId === nodeA.id);
    const evB = evidence.filter((e) => e.nodeId === nodeB.id);
    expect(evA).toHaveLength(4);
    expect(evB).toHaveLength(4);
    expect(computeNodeScore(evA, new Date())).toBe(100);
    expect(getNodeState(evA, new Date())).toBe("mastered");
    expect(computeNodeScore(evB, new Date())).toBe(63);
    expect(getNodeState(evB, new Date())).toBe("partial");
    expect(computePlanRollup({ [nodeA.id]: evA, [nodeB.id]: evB }, new Date())).toBe(81);
    expect(computeStreak(evidence, new Date())).toBe(1);

    // 6. mistakes from the same pass: the forfeit logged with its source
    expect(state.evidence).toHaveLength(8);
    expect(state.mistakes).toHaveLength(1);
    expect(state.mistakes[0].forfeited).toBe(true);
    expect(state.mistakes[0].sourceLocation).toEqual({ __typename: "ReadingLocator", kind: "pdf", page: expect.any(Number), sectionId: null });

    // reader state persisted alongside — through the persistence mutations,
    // landing in the echo server's captured rows
    const position: ReadingPosition = { locator: { kind: "pdf", page: 3 }, text: sections[2].text };
    await client.mutate({ mutation: SaveReadingProgressDocument, variables: { input: { materialId: "m-echo-1", position: { locator: position.locator, text: position.text } } } });
    await client.mutate({ mutation: AppendChatMessageDocument, variables: { input: { materialId: "m-echo-1", message: { role: "user", text: "这一页讲什么？", citations: [] } } } });

    // 7. reload simulation: fresh Apollo cache, same server state — the api
    //    keeps every row; a fresh blob registry loses the session bytes
    const reloaded = createStubClient(handlers, state);
    const evidenceAgain = await reloaded.query({ query: AllEvidenceDocument, fetchPolicy: "network-only" });
    expect(evidenceAgain.data.evidence).toHaveLength(8);
    const thread = await reloaded.query({ query: ChatThreadDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(thread.data.chatThread.messages).toHaveLength(1);
    const progress = await reloaded.query({ query: ReadingProgressDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(progress.data.readingProgress.position.locator).toEqual({ __typename: "ReadingLocator", kind: "pdf", page: 3 });
    expect(createSessionBlobRegistry().has("m-echo-1")).toBe(false); // blob gone — re-upload
  });
});

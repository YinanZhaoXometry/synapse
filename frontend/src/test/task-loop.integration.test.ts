/**
 * Epic-5 integration walk (T4), re-seated on the Apollo stub harness at the
 * cutover (epic P2-8): the Study Task loop (FR-37) walked across the same
 * seams as the evidence/reader loops — attach (the cutover's two-step upload:
 * attach mutation → presign → a real fetch PUT to storage, captured) →
 * createTask (the back-link + the exactly-one auto node) → eager parse →
 * reading-position save → AI-seam quiz generation, session creation, and the
 * atomic evidence batch against the task's node → exact ADR-0001 numbers on
 * the task rollup → reload simulation. No quiz UI: every step is the real
 * production seam the task flow calls (TaskCreatePage's attach→createTask→
 * parse sequence, the simulated Companion's generation, the typed-hooks
 * mutations). Prior art: evidence-loop.integration.test.ts.
 *
 * ADR-0001 numbers asserted (the worked sequence below):
 *   - window 5: after 6 records the score is the mean of the LAST 5 (the
 *     oldest correct falls out) — 80, not the plain-mean 83;
 *   - cap-99 below the evidence gate: 2 correct records → raw 100, displayed
 *     99 (ADR-0001 amendment: "a perfect-but-unverified node reads 99%" —
 *     the gate gates the score itself, not just the state);
 *   - mastered = score ≥ 80 AND ≥ 3 total records: the second round lands
 *     exactly on the 80 threshold with 6 records → mastered;
 *   - a Study Task's rollup = its single owned node's score
 *     (computeTaskRollup), and task evidence NEVER moves plan scores (AD-6
 *     isolation — the sibling plan's rollup stays 0/uncovered).
 */
import { Blob as NodeBlob } from "node:buffer";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { mapEvidence, mapMaterial } from "@/api/mappers";
import type { MaterialView } from "@/api/views";
import { useMaterialUpload } from "@/api";
import { createSessionBlobRegistry, sessionBlobs } from "@/lib/session-blobs";
import { createHarnessState, createStubClient, echoQuestion,
  echoTouchedNodes,
  echoTouchedPlan, makeStubWrapper, type HarnessState, type EchoFixture } from "@/test/apollo-harness";
import {
  AllEvidenceDocument,
  AttachMaterialDocument,
  CreateMaterialUploadDocument,
  CreatePlanDocument,
  CreateQuizSessionDocument,
  CreateTaskDocument,
  MaterialDocument,
  ReadingProgressDocument,
  RecordEvidenceDocument,
  SaveReadingProgressDocument,
  TaskDocument,
} from "@/types/graphql";
import { computeNodeScore, computePlanRollup, computeTaskRollup, getNodeState } from "@/domain/mastery";
import { getCompanionService } from "@/ai/companion-service";
import { useParseMaterialMutation } from "@/features/reader";
import { positionText } from "@/features/reader/position-tracking";
import { parseMaterialBytes } from "@/features/reader/parse-material";
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";

/**
 * A small real markdown document — three headings, so the eager parse yields
 * three sections and the generator yields six questions (choice + open per
 * section, under the 8-question cap), all attributed to the task's node.
 */
const markdownDoc = [
  "# 集成与单元",
  "集成测试关注组件之间的交互。接口契约必须先验证。",
  "# 需求工程",
  "需求工程把用户需要转化为规约。验收标准来自规约。",
  "# Mastery gates",
  "Evidence updates the score. Three verified records unlock the gate.",
  "",
].join("\n");

/** jsdom's Blob predates .arrayBuffer(), which the parse seam reads bytes
 * through — hand the upload Node's Blob (the reader-loop bridge), wearing the
 * File fields the flow reads (name; Node's Blob already sizes by its bytes). */
const mdFile = () => {
  const file = new NodeBlob([new TextEncoder().encode(markdownDoc)]) as unknown as File;
  Object.defineProperty(file, "name", { value: "复习讲义.md" });
  return file;
};

const CREATED = "2026-11-01T00:00:00Z";

describe("the task loop, end to end (create → attach → parse → read → quiz → evidence → reload)", () => {
  it("walks FR-37 across the seams and lands on ADR-0001's exact task-rollup numbers", async () => {
    // The echo server's captured rows — the reload leg's surviving world.
    const server = {
      nodes: [] as EchoFixture[],
      materials: [] as EchoFixture[],
      tasks: [] as EchoFixture[],
      progress: [] as EchoFixture[],
    };
    const state: HarnessState = createHarnessState();
/** The echo handlers widen the harness's object-only OperationHandler to the
 * wire-record EchoFixture: list roots return ARRAYS and handler inputs are the
 * server's own variable shapes — payloads stay structural, checked on read by
 * the mappers, never by the fixture types. */
type EchoHandler = (variables: EchoFixture, state: HarnessState) => unknown;

    // SERVER scores (AD-14): the echo derives them from the harness evidence
    // with the REAL domain functions — the stub plays by the api's rules.
    const nodeEvidence = (nodeId: string) => state.evidence.filter((e) => e.nodeId === nodeId).map(mapEvidence);
    const nodeRow = (row: EchoFixture) => ({
      ...row,
      masteryScore: String(computeNodeScore(nodeEvidence(row.id), new Date())),
      state: getNodeState(nodeEvidence(row.id), new Date()),
    });
    const handlers: Record<string, EchoHandler> = {
      // the presign: a PUT URL against storage.test — never through the api
      CreateMaterialUpload: (variables) => ({
        materialId: (variables.input as EchoFixture).materialId,
        uploadUrl: "https://storage.test/put",
        expiresAt: "2026-11-01T01:00:00Z",
      }),
      AttachMaterial: (variables) => {
        const input = variables.input as EchoFixture;
        const material = {
          __typename: "Material",
          id: `m-echo-${server.materials.length + 1}`,
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
      // createTask back-links the material and auto-creates the exactly-one
      // node titled from the material (AD-6)
      CreateTask: (variables) => {
        const input = variables.input as EchoFixture;
        const material = server.materials.find((m) => m.id === input.materialId)!;
        const task = { __typename: "StudyTask", id: `task-echo-${server.tasks.length + 1}`, materialId: material.id, nodeId: `node-task-${server.tasks.length + 1}`, createdAt: CREATED };
        const node = nodeRow({ __typename: "KnowledgeNode", id: task.nodeId, planId: null, taskId: task.id, description: null, optional: false, stage: null, title: material.title, order: 0, createdAt: CREATED });
        material.taskId = task.id;
        server.tasks.push(task);
        server.nodes.push(node);
        return { task: { id: task.id, materialId: task.materialId, nodeId: task.nodeId, createdAt: task.createdAt }, node };
      },
      Task: (variables) => {
        const task = server.tasks.find((t) => t.id === variables.id);
        if (!task) return null;
        const node = server.nodes.find((n) => n.taskId === task.id)!;
        // The promotion pointer rides every task read (epic-14 T2) — null for
        // these echo tasks; the cache write needs the field present.
        return { id: task.id, materialId: task.materialId, nodeId: task.nodeId, createdAt: task.createdAt, promotedPlanId: null, promotedAt: null, promotedPlan: null, node: nodeRow(node) };
      },
      CreatePlan: (variables) => {
        const input = variables.input as EchoFixture;
        const plan = { __typename: "StudyPlan", id: "plan-echo-1", topic: input.topic, goal: input.goal ?? null, createdAt: CREATED, masteryScore: "0" };
        const nodes = (input.nodes as EchoFixture[]).map((n, i) =>
          nodeRow({ __typename: "KnowledgeNode", id: `node-plan-${i + 1}`, planId: plan.id, taskId: null, description: null, optional: false, stage: n.stage ?? null, title: n.title, order: i, createdAt: CREATED }),
        );
        server.nodes.push(...nodes);
        return { plan, nodes };
      },
      SetMaterialParseResult: (variables) => {
        const input = variables.input as EchoFixture;
        const row = server.materials.find((m) => m.id === input.id)!;
        if (input.state === "parsing") throw new Error("VALIDATION_FAILED: parsing is not a wire state");
        row.parseState = input.state;
        row.parseFailureReason = input.reason ?? null;
        row.sections = (input.sections as EchoFixture[]).map((s) => ({ __typename: "MaterialSection", ...s }));
        return { material: row };
      },
      Material: (variables) => server.materials.find((m) => m.id === variables.id) ?? null,
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
          questions, // stored for the echo's attribution lookups
        };
        state.sessions.push(session);
        return { session, questions };
      },
      // the atomic batch: evidence + auto-mistakes + session completion in
      // ONE echo — attribution derives from the stored question rows
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
          createdAt: new Date(Date.now() + state.evidence.length + i).toISOString(), // distinct — recency is real
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
        // The payload's live-update half (epic P2-10 T3) — a task session's
        // plan is null; the nodes echo SERVER-shaped (full history) scores.
    return {
      evidence,
      mistakes,
      session,
      nodes: echoTouchedNodes(state, evidence, (id) => server.nodes.find((n) => n.id === id)),
      plan: echoTouchedPlan(state, (session?.planId as string) ?? null, server.nodes),
    };
      },
      AllEvidence: () => state.evidence,
    };
    const client = createStubClient(handlers, state);
    const providerWrapper = ({ children }: { children: ReactNode }) =>
      // (.ts file — the provider stack is built with createElement, no JSX)
      createElement(LanguageProvider, null, makeStubWrapper(client)({ children }));

    // 1. attach + create — exactly TaskCreatePage's sequence: attach the
    //    material parse-pending (taskId null — the material cannot know the
    //    task yet; the bytes PUT straight to storage through the presigned
    //    URL, captured below), then createTask back-links the material and
    //    auto-creates its exactly-one node (AD-6).
    const putCalls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: RequestInfo | URL, init: RequestInit = {}) => {
      putCalls.push({ url: String(url), init });
      return { ok: true };
    });
    const upload = renderHook(() => useMaterialUpload(), { wrapper: makeStubWrapper(client) });
    let attached: MaterialView | undefined;
    await act(async () => {
      attached = await upload.result.current.attach({ file: mdFile(), title: "复习讲义.md", kind: "markdown", planId: null, taskId: null });
    });
    expect(putCalls).toHaveLength(1); // the real presign PUT, straight to storage
    expect(putCalls[0].url).toBe("https://storage.test/put");
    expect(sessionBlobs.has(attached!.id)).toBe(true);

    const created = await client.mutate({ mutation: CreateTaskDocument, variables: { input: { clientUuid: crypto.randomUUID(), materialId: attached!.id } } });
    const task = created.data!.createTask.task;
    const node = created.data!.createTask.node;
    expect(task.materialId).toBe(attached!.id);
    expect(task.nodeId).toBe(node.id);
    // exactly ONE auto-created node, owned by the task, belonging to no plan
    const ownedNodes = server.nodes.filter((n) => n.taskId === task.id);
    expect(ownedNodes).toHaveLength(1);
    expect(node.planId).toBeNull();
    expect(node.taskId).toBe(task.id);
    expect(node.title).toBe("复习讲义.md"); // titled from the material (AD-6)
    // material back-linked (the task home's 1:1 row resolves through this)
    const materialRow = await client.query({ query: MaterialDocument, variables: { id: attached!.id }, fetchPolicy: "network-only" });
    expect(materialRow.data.material.taskId).toBe(task.id);

    // 2. the AD-6 isolation control: a plan + node sibling, sharing NOTHING
    //    with the task — its evidence set stays empty forever, below.
    const plan = await client.mutate({ mutation: CreatePlanDocument, variables: { input: { clientUuid: crypto.randomUUID(), topic: "COMP5241 软件工程", goal: "exam prep", nodes: [{ title: "sibling 节点", stage: "需求" }] } } });
    const planNode = plan.data!.createPlan.nodes[0];
    expect(planNode.taskId).toBeNull();

    // 3. eager parse (AD-7): the reader's public path, run exactly as the
    //    creation flow runs it — the row binds once the attach lands, session
    //    bytes in, honest outcome written back through SetMaterialParseResult.
    const parse = renderHook(() => useParseMaterialMutation(attached), { wrapper: providerWrapper });
    parse.result.current.mutate(attached!.id);
    // Same write-back chain as the reader loop — room for a loaded CI runner.
    await waitFor(() => expect(server.materials[0].parseState).toBe("parsed"), { timeout: 10_000 });
    const parsedRaw = await client.query({ query: MaterialDocument, variables: { id: attached!.id }, fetchPolicy: "network-only" });
    const parsed = mapMaterial(parsedRaw.data.material);
    expect(parsed.parseState).toBe("parsed");
    expect(parsed.sections).toHaveLength(3); // one per heading

    // 4. read (FR-10): the tracker's bounded text resolver persists what is
    //    visible — an extract of the section, never raw file bytes (AD-4).
    const locator: ReadingLocator = { kind: "markdown", sectionId: parsed.sections[0].id };
    const position: ReadingPosition = { locator, text: positionText(parsed, locator) };
    expect(position.text).toBe(parsed.sections[0].text);
    await client.mutate({ mutation: SaveReadingProgressDocument, variables: { input: { materialId: attached!.id, position: { locator: position.locator, text: position.text } } } });
    const progress = await client.query({ query: ReadingProgressDocument, variables: { materialId: attached!.id }, fetchPolicy: "network-only" });
    expect(progress.data.readingProgress.position.locator).toEqual({ __typename: "ReadingLocator", kind: "markdown", sectionId: locator.sectionId });

    // 5. quiz generation against the task's node: sections + [taskNodeId] —
    //    every question attributed to the single owned node (AD-6) and
    //    sourced from the material's own sections (FR-18/NFR-1).
    const svc = getCompanionService();
    const questions = await svc.generateQuiz({
      materials: [{ materialId: attached!.id, sections: parsed.sections }],
      nodeIds: [node.id],
      mode: "mix",
    });
    expect(questions).toHaveLength(6); // 3 sections × (choice + open), under the cap
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([node.id]));
    const sectionIds = new Set(parsed.sections.map((s) => s.id));
    for (const q of questions) {
      expect(q.sourceMaterialId).toBe(attached!.id);
      expect(sectionIds.has(q.sourceSectionId)).toBe(true);
    }

    // 6. round one — 2 answers, both correct. ADR-0001 cap-99 below the
    //    gate: the raw mean is 100, but 2 records < gate 3, so the node
    //    displays at most 99 — score 100 must mean VERIFIED mastery, and a
    //    perfect-but-unverified node reads 99% ("one more verified round").
    const first = await client.mutate({ mutation: CreateQuizSessionDocument, variables: { input: { clientUuid: crypto.randomUUID(), planId: null, taskId: task.id, mode: "mix", questions } } });
    expect(first.data!.createQuizSession.session.planId).toBeNull();
    expect(first.data!.createQuizSession.session.taskId).toBe(task.id);
    const firstQuestions = first.data!.createQuizSession.questions;
    const roundOne = firstQuestions.slice(0, 2).map((q) => ({
      questionId: q.id,
      outcome: "correct",
      userAnswer: "answered",
      forfeited: false,
    }));
    const firstRecorded = await client.mutate({ mutation: RecordEvidenceDocument, variables: { input: { sessionId: first.data!.createQuizSession.session.id, results: roundOne } } });
    // recordEvidence closes the session (the echo's returned copy)
    expect(firstRecorded.data!.recordEvidence.session.status).toBe("completed");

    const afterRoundOne = firstRecorded.data!.recordEvidence.evidence.map(mapEvidence);
    expect(afterRoundOne).toHaveLength(2);
    expect(computeNodeScore(afterRoundOne, new Date())).toBe(99); // capped — raw would be 100
    expect(computeTaskRollup(afterRoundOne, new Date())).toBe(99); // task rollup = its single node's score (ADR-0001)
    expect(getNodeState(afterRoundOne, new Date())).toBe("partial"); // ≥80 but the gate is unmet

    // 7. round two — the "one more verified round": a fresh session against
    //    the same node; first answer forfeited, then three correct. Six
    //    records total now; the window is the LAST 5, so the oldest round-one
    //    correct falls out: values (newest first) 1,1,1,0,1 → 80 — the plain
    //    mean over all six would be 83, so this number pins the window. The
    //    gate is met (6 ≥ 3) and 80 is exactly the mastered threshold
    //    (score ≥ 80 AND ≥ 3 → mastered).
    const secondQuestions = await svc.generateQuiz({
      materials: [{ materialId: attached!.id, sections: parsed.sections }],
      nodeIds: [node.id],
      mode: "mix",
    });
    const second = await client.mutate({ mutation: CreateQuizSessionDocument, variables: { input: { clientUuid: crypto.randomUUID(), planId: null, taskId: task.id, mode: "mix", questions: secondQuestions } } });
    const secondSessionQuestions = second.data!.createQuizSession.questions;
    const roundTwo = secondSessionQuestions.slice(0, 4).map((q, i) =>
      i === 0
        ? { questionId: q.id, outcome: "wrong", userAnswer: "", forfeited: true }
        : { questionId: q.id, outcome: "correct", userAnswer: "answered", forfeited: false },
    );
    await client.mutate({ mutation: RecordEvidenceDocument, variables: { input: { sessionId: second.data!.createQuizSession.session.id, results: roundTwo } } });

    const evidence = state.evidence.map(mapEvidence);
    expect(evidence).toHaveLength(6);
    expect(computeTaskRollup(evidence, new Date())).toBe(80); // window-5 mean, exactly the mastered threshold
    expect(getNodeState(evidence, new Date())).toBe("mastered"); // ≥80 AND ≥3 (ADR-0001)
    const taskAgain = await client.query({ query: TaskDocument, variables: { id: task.id }, fetchPolicy: "network-only" });
    expect(taskAgain.data.task.node.id).toBe(node.id); // the task's mastery IS this node's

    // 8. AD-6 isolation: every evidence record belongs to the task's node —
    //    the sibling plan's node has none, so its rollup stays 0 (uncovered
    //    nodes count 0) and the task's evidence cannot move any plan score.
    const planEvidence = nodeEvidence(planNode.id);
    expect(planEvidence).toHaveLength(0);
    expect(computePlanRollup({ [planNode.id]: planEvidence }, new Date())).toBe(0);
    expect(new Set(state.evidence.map((e) => e.nodeId))).toEqual(new Set([node.id]));

    // 9. mistakes from the same pass (FR-18): the forfeit is logged with its
    //    markdown source section — wrong/forfeit = logged, no credit.
    expect(state.mistakes).toHaveLength(1);
    expect(state.mistakes[0].forfeited).toBe(true);
    expect(state.mistakes[0].nodeId).toBe(node.id);
    expect(state.mistakes[0].sourceLocation).toEqual({
      __typename: "ReadingLocator",
      kind: "markdown",
      page: null,
      sectionId: secondSessionQuestions[0].sourceSectionId,
    });

    // 10. reload simulation (the honest kind): same server state, fresh
    //     Apollo cache — the walk re-queries through a FRESH stub client.
    //     Task, node, material metadata, reading progress, and evidence all
    //     survive server-side; the session-only bytes do not (re-upload
    //     contract, FR-29).
    const reloaded = createStubClient(handlers, state);
    const reloadedTask = await reloaded.query({ query: TaskDocument, variables: { id: task.id }, fetchPolicy: "network-only" });
    expect(reloadedTask.data.task.materialId).toBe(attached!.id);
    expect(reloadedTask.data.task.nodeId).toBe(node.id);
    expect(reloadedTask.data.task.node.planId).toBeNull();
    expect(reloadedTask.data.task.node.taskId).toBe(task.id);
    const reloadedMaterialRaw = await reloaded.query({ query: MaterialDocument, variables: { id: attached!.id }, fetchPolicy: "network-only" });
    const reloadedMaterial = mapMaterial(reloadedMaterialRaw.data.material);
    expect(reloadedMaterial.taskId).toBe(task.id); // the back-link persists
    expect(reloadedMaterial.parseState).toBe("parsed");
    expect(reloadedMaterial.sections).toEqual(parsed.sections);
    const reloadedProgress = await reloaded.query({ query: ReadingProgressDocument, variables: { materialId: attached!.id }, fetchPolicy: "network-only" });
    expect(reloadedProgress.data.readingProgress.position.locator).toEqual({ __typename: "ReadingLocator", kind: "markdown", sectionId: locator.sectionId });
    const reloadedEvidence = (await reloaded.query({ query: AllEvidenceDocument, fetchPolicy: "network-only" })).data.evidence.map(mapEvidence);
    expect(reloadedEvidence).toHaveLength(6);

    // the numbers recompute from the server's evidence alone — same ADR-0001
    // verdicts through the same domain functions (the golden-vector source)
    expect(computeTaskRollup(reloadedEvidence, new Date())).toBe(80);
    expect(getNodeState(reloadedEvidence, new Date())).toBe("mastered");
    expect(reloadedEvidence.filter((e) => e.nodeId === planNode.id)).toHaveLength(0); // isolation persists too

    // bytes were memory-only: gone after reload — the reader's re-upload
    // contract, never a fake parse (mirrors the reader-loop walk)
    expect(sessionBlobs.has(attached!.id)).toBe(true); // this TAB still holds them…
    expect(createSessionBlobRegistry().has(attached!.id)).toBe(false); // …a reload does not
    expect(await parseMaterialBytes(reloadedMaterial, createSessionBlobRegistry().get(attached!.id))).toBeNull();
  });
});

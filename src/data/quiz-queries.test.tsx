import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPlan,
  createQuizSession,
  createStudyTask,
  getTask,
  getTaskNode,
  listPlans,
  listTasks,
  registerMaterial,
} from "@/data";
import { queryKeys } from "@/data/query-keys";
import type { AnswerResult } from "@/data/quiz-repository";
import { useRecordEvidenceMutation } from "./quiz-queries";

/**
 * The evidence mutation's cache-freshness contract (epic-6 T4 — the deferred
 * epic-5 obligation): a task quiz's evidence invalidates the tasks keys, so
 * Task Home's ring and Plans Home's Study Tasks section refetch instead of
 * reading a stale cache; a plan quiz's evidence keeps invalidating the plan
 * keys and touches no tasks key (AD-6 isolation in the cache, too).
 *
 * Observable state, not internals: each query's cache state flips
 * `isInvalidated` — TanStack's own freshness signal (a mounted observer
 * refetches on it, a fresh mount refetches because the entry is stale).
 */

/** Seed a task (its auto-owned node) and a sibling plan, both over real repositories. */
function seedTaskAndPlan() {
  const { material } = registerMaterial({
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: null,
    taskId: null,
    sections: [{ id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" }],
    parseState: "parsed",
  });
  const { task, node } = createStudyTask({ materialId: material.id });
  const { plan } = createPlan({ topic: "别的计划", goal: null, nodes: [{ title: "n", stage: null }] });
  return { material, task, node, plan };
}

/** A one-question session for the given owner — the questions recordEvidence validates. */
function seedSession(owner: { planId: string | null; taskId: string | null }, nodeId: string, materialId: string) {
  return createQuizSession({
    planId: owner.planId,
    taskId: owner.taskId,
    mode: "choice",
    questions: [
      {
        prompt: "q-1",
        nodeId,
        kind: "choice",
        options: ["right", "wrong"],
        correctOptionIndex: 0,
        sourceMaterialId: materialId,
        sourceSectionId: "sec-1",
        explanation: "because",
      },
    ],
  });
}

function Harness({ sessionId, results }: { sessionId: string; results: AnswerResult[] }) {
  const recordEvidence = useRecordEvidenceMutation();
  return (
    <button type="button" data-testid="record" onClick={() => void recordEvidence.mutateAsync({ sessionId, results })}>
      record
    </button>
  );
}

function renderHarness(client: QueryClient, sessionId: string, results: AnswerResult[]) {
  render(
    <QueryClientProvider client={client}>
      <Harness sessionId={sessionId} results={results} />
    </QueryClientProvider>,
  );
}

const allCorrect = (questions: ReturnType<typeof seedSession>["questions"]): AnswerResult[] =>
  questions.map((q) => ({ questionId: q.id, outcome: "correct", userAnswer: "right", forfeited: false }));

beforeEach(() => {
  localStorage.clear();
});

describe("useRecordEvidenceMutation — cache freshness (T4 tasks-key invalidation; epic-5 defer)", () => {
  it("task evidence invalidates the tasks keys — detail + node flip stale alongside the list", async () => {
    const { material, task, node } = seedTaskAndPlan();
    const { session, questions } = seedSession({ planId: null, taskId: task.id }, node.id, material.id);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    // Prime the cache entries the surfaces read (Task Home's ring/node +
    // Plans Home's task list), so invalidation has state to flip.
    await client.fetchQuery({ queryKey: queryKeys.tasks.all, queryFn: listTasks });
    await client.fetchQuery({ queryKey: queryKeys.tasks.detail(task.id), queryFn: () => getTask(task.id) });
    await client.fetchQuery({ queryKey: queryKeys.tasks.node(task.id), queryFn: () => getTaskNode(task.id) });
    expect(client.getQueryState(queryKeys.tasks.all)?.isInvalidated).toBe(false);

    renderHarness(client, session.id, allCorrect(questions));
    fireEvent.click(screen.getByTestId("record"));

    await waitFor(() => {
      expect(client.getQueryState(queryKeys.tasks.all)?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.tasks.detail(task.id))?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.tasks.node(task.id))?.isInvalidated).toBe(true);
    });
  });

  it("plan evidence still invalidates the plan keys — and touches no tasks key (AD-6 in the cache)", async () => {
    const { material, node, plan, task } = seedTaskAndPlan();
    const { session, questions } = seedSession({ planId: plan.id, taskId: null }, node.id, material.id);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await client.fetchQuery({ queryKey: queryKeys.plans.all, queryFn: listPlans });
    await client.fetchQuery({ queryKey: queryKeys.tasks.all, queryFn: listTasks });
    await client.fetchQuery({ queryKey: queryKeys.tasks.node(task.id), queryFn: () => getTaskNode(task.id) });
    expect(client.getQueryState(queryKeys.tasks.all)?.isInvalidated).toBe(false);

    renderHarness(client, session.id, allCorrect(questions));
    fireEvent.click(screen.getByTestId("record"));

    await waitFor(() => {
      expect(client.getQueryState(queryKeys.plans.all)?.isInvalidated).toBe(true);
    });
    // the plan session's evidence moved a PLAN node — no task surface refreshes
    expect(client.getQueryState(queryKeys.tasks.all)?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.tasks.node(task.id))?.isInvalidated).toBe(false);
  });
});

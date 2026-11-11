/**
 * usePlanCompanionChat — the plan thread's persistence walk (epic-25 T2).
 * The plan scope NOW has a ChatThread (T1's schema movement), so the hook
 * pins the same honesty rules as the material hook, asserted through the
 * production Apollo seam (the use-reading-position.test.tsx exact-variables
 * mock pattern — a mismatch misses the mock and the assertion fails):
 *
 *   1. hydrate-once-per-plan — the server thread shapes into the transcript
 *      exactly once (entriesFromThread: server ids, no reply contract, no
 *      request); later refetches (our own appends') never re-shape.
 *   2. append-on-complete — EXACTLY two appends per completed turn, user row
 *      first, then the companion row with its citation locators, both
 *      addressed to planId (not materialId).
 *   3. a plan switch re-hydrates from the NEW plan's server thread.
 *   4. a failed turn persists nothing.
 *
 * The AI seam is injected (setCompanionService) so no socket opens; the
 * stub RECORDS the planChat request and resolves a fixture reply.
 */
import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedProviderProps } from "@apollo/client/testing/react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import type { CompanionReply, PlanChatRequest } from "@/ai/types";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  AppendChatMessageDocument,
  PlanChatThreadDocument,
  type AppendChatMessageMutationVariables,
  type PlanChatThreadQueryVariables,
} from "@/types/graphql";
import { usePlanCompanionChat } from "./use-plan-companion-chat";

type AnyMock = NonNullable<MockedProviderProps["mocks"]>[number];

const QUESTION = "怎么制定学习计划？";
const REPLY_TEXT = "先看节点层的顺序，材料里有对应章节。";
const LOCATOR = { kind: "markdown", sectionId: "sec-1" } as const;

const fixtureReply: CompanionReply = {
  intent: "explain",
  rung: "hint",
  text: REPLY_TEXT,
  citations: [{ locator: LOCATOR }],
  canEscalate: false,
  language: "zh",
};

const planChatRequests: PlanChatRequest[] = [];

const stubService = (): CompanionService => ({
  chat: vi.fn(),
  planChat: (request, onToken) => {
    planChatRequests.push(request);
    onToken?.(REPLY_TEXT.slice(0, 2));
    return Promise.resolve(fixtureReply);
  },
  generatePlanStructure: vi.fn(),
  generateQuiz: vi.fn(),
  generateFlashcards: vi.fn(),
  gradeOpenAnswer: vi.fn(),
});

/** Server-shaped thread row (the wire's ChatThread — the mock answers what
 * the operation selected, __typename rides for the normalized cache write). */
const threadWire = (planId: string, messages: Array<Record<string, unknown>>) => ({
  __typename: "ChatThread",
  id: `thread-plan-${planId}`,
  materialId: null,
  planId,
  updatedAt: "2026-11-07T00:00:00Z",
  messages,
});

const messageWire = (id: string, role: string, text: string, citations: Array<Record<string, unknown>> = []) => ({
  __typename: "ChatMessage",
  id,
  role,
  text,
  createdAt: "2026-11-07T00:00:00Z",
  citations,
});

/** plan-1's persisted thread BEFORE this session: one completed past turn. */
const restoredThread = () =>
  threadWire("plan-1", [
    messageWire("srv-u1", "user", "集成测试和单元测试有什么区别？"),
    messageWire("srv-c1", "companion", "先往这个方向想……", [{ __typename: "ReadingLocator", kind: "pdf", page: 7, sectionId: null }]),
  ]);

/** Server-side view AFTER the new turn lands (refetch responses): the
 * restored rows plus the two rows the appends wrote. */
const threadAfterTurn = (appended: Array<Record<string, unknown>>) => ({
  ...restoredThread(),
  messages: [...restoredThread().messages, ...appended],
});

const planThreadMock = (planId: string, thread: Record<string, unknown>): AnyMock => ({
  request: { query: PlanChatThreadDocument, variables: { planId } satisfies PlanChatThreadQueryVariables },
  delay: 0,
  result: { data: { planChatThread: thread } },
});

/** Exact-variables append mock — the recorded write IS the assertion surface
 * (order + plan addressing + citation locators). */
function makeAppendSink(): { sink: AppendChatMessageMutationVariables["input"][]; mocks: AnyMock[] } {
  const sink: AppendChatMessageMutationVariables["input"][] = [];
  const mock: AnyMock = {
    request: {
      query: AppendChatMessageDocument,
      variables: {
        input: { planId: "plan-1", message: { role: "user", text: QUESTION, citations: [] } },
      } satisfies AppendChatMessageMutationVariables,
    },
    delay: 0,
    result: (variables: AppendChatMessageMutationVariables) => {
      sink.push(variables.input);
      return {
        data: {
          appendChatMessage: {
            __typename: "AppendMessagePayload",
            message: messageWire(`srv-append-${sink.length}`, "user", QUESTION, []),
          },
        },
      };
    },
  };
  const companionMock: AnyMock = {
    request: {
      query: AppendChatMessageDocument,
      variables: {
        input: {
          planId: "plan-1",
          message: { role: "companion", text: REPLY_TEXT, citations: [LOCATOR] },
        },
      } satisfies AppendChatMessageMutationVariables,
    },
    delay: 0,
    result: (variables: AppendChatMessageMutationVariables) => {
      sink.push(variables.input);
      return {
        data: {
          appendChatMessage: {
            __typename: "AppendMessagePayload",
            message: messageWire(`srv-append-${sink.length}`, "companion", REPLY_TEXT, [
              { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "sec-1" },
            ]),
          },
        },
      };
    },
  };
  return { sink, mocks: [mock, companionMock] };
}

function makeWrapper(mocks: AnyMock[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider>
        <MockedProvider mocks={mocks} mockLinkDefaultOptions={{ delay: 0 }}>
          {children}
        </MockedProvider>
      </LanguageProvider>
    );
  };
}

beforeEach(() => {
  planChatRequests.length = 0;
  setCompanionService(stubService());
});

afterEach(() => {
  setCompanionService(null);
});

describe("usePlanCompanionChat — the plan thread's persistence walk (epic-25 T2)", () => {
  it("hydrates once per plan from the server thread (server ids shaped, no reply contract)", async () => {
    const { result } = renderHook(() => usePlanCompanionChat("plan-1"), {
      wrapper: makeWrapper([planThreadMock("plan-1", restoredThread())]),
    });

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });
    expect(result.current.entries.map((entry) => entry.id)).toEqual(["srv-u1", "srv-c1"]);
    expect(result.current.entries.map((entry) => entry.role)).toEqual(["user", "companion"]);
    expect(result.current.entries[1].citations).toEqual([{ kind: "pdf", page: 7 }]);
    // restored rows are plain cited bubbles — the reply contract and the
    // request are runtime-only, never persisted
    expect(result.current.entries[1].reply).toBeNull();
    expect(result.current.entries[1].request).toBeNull();
    expect(planChatRequests).toHaveLength(0);
  });

  it("a completed turn appends EXACTLY two rows — user first, then companion with citation locators", async () => {
    const { sink, mocks } = makeAppendSink();
    const { result } = renderHook(() => usePlanCompanionChat("plan-1"), {
      wrapper: makeWrapper([
        planThreadMock("plan-1", restoredThread()),
        ...mocks,
        // the two refetches the api append hook declares — the thread the
        // server would answer AFTER both rows landed
        planThreadMock("plan-1", threadAfterTurn([messageWire("srv-append-1", "user", QUESTION)])),
        planThreadMock("plan-1", threadAfterTurn([
          messageWire("srv-append-1", "user", QUESTION),
          messageWire("srv-append-2", "companion", REPLY_TEXT, [{ __typename: "ReadingLocator", ...LOCATOR }]),
        ])),
      ]),
    });
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(1);
    });
    await act(async () => {}); // flush the mutations + their refetches

    // the two-append discipline: user row first, companion row with its
    // citation locators second, both addressed to the PLAN (never materialId)
    expect(sink).toEqual([
      { planId: "plan-1", message: { role: "user", text: QUESTION, citations: [] } },
      { planId: "plan-1", message: { role: "companion", text: REPLY_TEXT, citations: [LOCATOR] } },
    ]);

    // the live transcript kept its ids — the refetches (which now carry the
    // appended server rows) never re-shaped it
    const ids = result.current.entries.map((entry) => entry.id);
    expect(ids).toHaveLength(4);
    expect(ids.slice(0, 2)).toEqual(["srv-u1", "srv-c1"]);
    expect(result.current.entries[2].text).toBe(QUESTION);
    expect(result.current.entries[3].text).toBe(REPLY_TEXT);
    expect(result.current.entries[3].citations).toEqual([LOCATOR]);
  });

  it("a plan switch re-hydrates from the NEW plan's server thread", async () => {
    const { result, rerender } = renderHook(({ planId }: { planId: string }) => usePlanCompanionChat(planId), {
      initialProps: { planId: "plan-1" },
      wrapper: makeWrapper([
        planThreadMock("plan-1", restoredThread()),
        planThreadMock("plan-2", threadWire("plan-2", [messageWire("srv-u9", "user", "plan-2 的问题")])),
      ]),
    });
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });
    expect(result.current.entries.map((entry) => entry.id)).toEqual(["srv-u1", "srv-c1"]);

    rerender({ planId: "plan-2" });

    await waitFor(() => {
      expect(result.current.entries.map((entry) => entry.id)).toEqual(["srv-u9"]);
    });
    // plan-1's turns never render under plan-2; the hook is live again
    expect(result.current.busy).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("a failed turn persists nothing", async () => {
    const failing = stubService();
    failing.planChat = () => Promise.reject(new Error("boom"));
    setCompanionService(failing);

    // The append mocks exist ONLY as recording sinks — if the hook (wrongly)
    // persisted the failed turn, the sink would fill and the assertion below
    // fails. Nothing fires: a failed turn never reaches the thread.
    const { sink, mocks } = makeAppendSink();
    const { result } = renderHook(() => usePlanCompanionChat("plan-1"), {
      wrapper: makeWrapper([planThreadMock("plan-1", restoredThread()), ...mocks]),
    });
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.entries[2]?.failed).toBe(true);
    });

    expect(sink).toEqual([]);
    // the turn stays visibly failed and the typed text returns to the composer
    expect(result.current.entries).toHaveLength(3);
    expect(result.current.input).toBe(QUESTION);
    expect(result.current.busy).toBe(false);
  });
});

// epic-34 T2 — the AI 讲解 drawer-session memory: while a node teaching
// session is marked, EVERY turn rides its nodeId on the planChat request
// (the ticket's grounding input); the generic entry (clearTeaching) drops
// it, another node's 讲解 replaces it, and a plan switch clears it with
// the rest of the reset. Pure frontend state — asserted at the seam the
// stub records (the request), never at internals.
describe("usePlanCompanionChat — the AI 讲解 session memory (epic-34 T2)", () => {
  function hydratedHook(mocks: AnyMock[]) {
    const rendered = renderHook(() => usePlanCompanionChat("plan-1"), {
      wrapper: makeWrapper([planThreadMock("plan-1", restoredThread()), ...mocks]),
    });
    return rendered;
  }

  it("beginTeaching marks the session: EVERY send rides the node's nodeId", async () => {
    // Two identical sends ride the same two exact-variables append mocks
    // (each consumed once, in order).
    const { mocks: firstTurn } = makeAppendSink();
    const { mocks: secondTurn } = makeAppendSink();
    const { result } = hydratedHook([ ...firstTurn, ...secondTurn ]);
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.beginTeaching({ id: "node-9", title: "Raft 选举" });
    });
    expect(result.current.teachNode).toEqual({ id: "node-9", title: "Raft 选举" });

    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(1);
    });
    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(2);
    });

    expect(planChatRequests.map((request) => request.nodeId)).toEqual(["node-9", "node-9"]);
  });

  it("clearTeaching drops the mark — later turns ride no nodeId", async () => {
    const { mocks: firstTurn } = makeAppendSink();
    const { mocks: secondTurn } = makeAppendSink();
    const { result } = hydratedHook([ ...firstTurn, ...secondTurn ]);
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.beginTeaching({ id: "node-9", title: "Raft 选举" });
    });
    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(1);
    });
    act(() => {
      result.current.clearTeaching();
    });
    expect(result.current.teachNode).toBeNull();
    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(2);
    });

    expect(planChatRequests.map((request) => request.nodeId)).toEqual(["node-9", undefined]);
  });

  it("teaching another node replaces the mark (the last 讲解 wins)", async () => {
    const { mocks: firstTurn } = makeAppendSink();
    const { mocks: secondTurn } = makeAppendSink();
    const { result } = hydratedHook([ ...firstTurn, ...secondTurn ]);
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.beginTeaching({ id: "node-9", title: "Raft 选举" });
    });
    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(1);
    });
    act(() => {
      result.current.beginTeaching({ id: "node-10", title: "日志复制" });
    });
    act(() => {
      result.current.send(QUESTION);
    });
    await waitFor(() => {
      expect(result.current.completionSignal).toBe(2);
    });

    expect(planChatRequests.map((request) => request.nodeId)).toEqual(["node-9", "node-10"]);
    expect(result.current.teachNode).toEqual({ id: "node-10", title: "日志复制" });
  });

  it("a plan switch clears the teaching mark with the rest of the session reset", async () => {
    const { result, rerender } = renderHook(({ planId }: { planId: string }) => usePlanCompanionChat(planId), {
      initialProps: { planId: "plan-1" },
      wrapper: makeWrapper([
        planThreadMock("plan-1", restoredThread()),
        planThreadMock("plan-2", threadWire("plan-2", [])),
      ]),
    });
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });
    act(() => {
      result.current.beginTeaching({ id: "node-9", title: "Raft 选举" });
    });

    rerender({ planId: "plan-2" });

    expect(result.current.teachNode).toBeNull();
  });
});

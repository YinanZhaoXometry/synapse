/**
 * The reader-level Quick Test flow (FR-14, epic-13 T2) — T1's seam consumer:
 * the gate's four states (pure resolution + the honest mapping-read
 * postures), the seam handler's registration/disposal (dispatch reaches the
 * launch; unmount leaves no stale flow), the dispatch → generate → session
 * takeover walk (the wire carries the material scope; the session id lands
 * in the URL — AD-8), and the full answer → grade → evidence round-trip
 * through the EXISTING driver harness (wrong answers + evidence captured on
 * the wire — the FR-14 consequences).
 */
import { MockedProvider } from "@apollo/client/testing/react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { echoQuestion } from "@/test/apollo-harness";
import type { MaterialSection } from "@/domain/entities";
import type { MaterialNodeMappingView } from "@/api/views";
import {
  AllEvidenceDocument,
  CreateQuizSessionDocument,
  MaterialNodeMappingsDocument,
  QuizSessionDocument,
  RecordEvidenceDocument,
} from "@/types/graphql";
import { dispatchQuickTest, registerQuickTestHandler } from "./quick-test-seam";
import { quickTestGate, quickTestSectionId } from "./quick-test-gate";
import { QuickTestFlow } from "./quick-test-flow";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

const PLAN_ID = "plan-1";
const NODE_ID = "node-1";
const MATERIAL_ID = "m-1";

const materialFixture = {
  id: MATERIAL_ID,
  title: "复习讲义.md",
  kind: "markdown" as const,
  sizeBytes: 64,
  planId: PLAN_ID,
  taskId: null,
  attachmentScope: "plan" as const,
  nodeId: null,
  parseState: "parsed" as const,
  parseFailureReason: null,
  sections,
  createdAt: "2026-11-01T00:00:00Z",
  downloadUrl: null,
};

const planNodesFixture = [
  {
    id: NODE_ID,
    planId: PLAN_ID,
    taskId: null,
    title: "测试节点",
    stage: "foundations" as const,
    description: null,
    optional: false, studyMark: null,
    order: 0,
    masteryScore: "0",
    state: "uncovered" as const,
  },
];

const mappingRow = (overrides: Partial<MaterialNodeMappingView> = {}): MaterialNodeMappingView => ({
  id: "map-1",
  materialId: MATERIAL_ID,
  nodeId: NODE_ID,
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "confirmed",
  createdAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

/** The gate resolution: pure over the read's outcome. */
describe("quickTestGate (the mapping-read resolution)", () => {
  it("reads unlanded data as loading, and a failed read as error", () => {
    expect(quickTestGate(undefined, undefined)).toBe("loading");
    expect(quickTestGate(undefined, new Error("network down"))).toBe("error");
  });

  it("reads a landed read by its confirmed rows: none → hidden, confirmed → ready", () => {
    expect(quickTestGate([], null)).toBe("none");
    expect(quickTestGate([mappingRow({ status: "proposed" })], null)).toBe("none");
    expect(quickTestGate([mappingRow({ status: "rejected" })], null)).toBe("none");
    expect(quickTestGate([mappingRow({ status: "confirmed", nodeId: null })], null)).toBe("none");
    expect(quickTestGate([mappingRow({ status: "proposed" }), mappingRow()], null)).toBe("ready");
  });
});

describe("quickTestSectionId (the parse convention)", () => {
  it("carries the markdown slug verbatim and names pdf pages page-N", () => {
    expect(quickTestSectionId({ kind: "markdown", sectionId: "sec-1", text: "t" })).toBe("sec-1");
    expect(quickTestSectionId({ kind: "pdf", page: 3, text: "t" })).toBe("page-3");
  });
});

/** The dispatch scope the selection bar hands over (markdown selection). */
const dispatchScope = {
  materialId: MATERIAL_ID,
  selection: { kind: "markdown" as const, sectionId: "sec-1", text: "集成测试关注组件之间的交互。" },
};

/** The wire captures the walks assert on. */
let createdSessions: Array<Record<string, unknown>>;
let recordedBatches: Array<Record<string, unknown>>;
let generatedQuizInputs: Array<Record<string, unknown>>;
const failState = { fail: false };

vi.mock("@/ai/companion-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/companion-service")>();
  const real = actual.getCompanionService();
  return {
    ...actual,
    getCompanionService: () => ({
      chat: (...args: Parameters<typeof real.chat>) => real.chat(...args),
      planChat: (...args: Parameters<typeof real.planChat>) => real.planChat(...args),
      generatePlanStructure: (...args: Parameters<typeof real.generatePlanStructure>) => real.generatePlanStructure(...args),
      generateQuiz: async (input: Parameters<typeof real.generateQuiz>[0]) => {
        generatedQuizInputs.push(input as unknown as Record<string, unknown>);
        if (failState.fail) throw new Error("simulated outage");
        return real.generateQuiz(input);
      },
      generateFlashcards: (...args: Parameters<typeof real.generateFlashcards>) => real.generateFlashcards(...args),
      gradeOpenAnswer: (...args: Parameters<typeof real.gradeOpenAnswer>) => real.gradeOpenAnswer(...args),
    }),
  };
});

function mappingMocks(rows: MaterialNodeMappingView[]) {
  return [
    {
      request: {
        query: MaterialNodeMappingsDocument,
        variables: (variables: Record<string, unknown>) => variables?.materialId === MATERIAL_ID,
      },
      result: { data: { materialNodeMappings: rows.map((row) => ({ __typename: "MaterialNodeMapping", ...row })) } },
    },
    {
      request: { query: AllEvidenceDocument, variables: {} },
      result: { data: { evidence: [] } },
    },
  ];
}

const createQuizSessionMock = {
  request: {
    query: CreateQuizSessionDocument,
    variables: (variables: Record<string, unknown>) => !!variables?.input,
  },
  result: (variables: Record<string, unknown>) => {
    const input = variables.input as Record<string, unknown>;
    const sessionId = `s-echo-${createdSessions.length + 1}`;
    const session = {
      __typename: "QuizSession",
      id: sessionId,
      planId: input.planId ?? null,
      taskId: input.taskId ?? null,
      mode: input.mode,
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
      completedAt: null,
    };
    const questions = (input.questions as Array<Record<string, unknown>>).map((q, i) => echoQuestion(q, sessionId, i));
    createdSessions.push({ input, session, questions });
    return { data: { createQuizSession: { __typename: "CreateSessionPayload", session, questions } } };
  },
  maxUsageCount: 10,
};

const recordEvidenceMock = {
  request: {
    query: RecordEvidenceDocument,
    variables: (variables: Record<string, unknown>) => !!variables?.input,
  },
  result: (variables: Record<string, unknown>) => {
    const input = variables.input as Record<string, unknown>;
    const sessionId = String(input.sessionId);
    const results = input.results as Array<Record<string, unknown>>;
    recordedBatches.push({ sessionId, results });
    const evidence = results.map((r, i) => ({
      __typename: "EvidenceRecord",
      id: `e-${sessionId}-${i}`,
      nodeId: NODE_ID,
      sessionId,
      questionId: r.questionId,
      outcome: r.outcome,
      createdAt: "2026-11-02T00:00:00Z",
    }));
    const mistakes = results
      .filter((r) => r.outcome === "wrong")
      .map((r, i) => ({
        __typename: "MistakeEntry",
        id: `mist-${sessionId}-${i}`,
        questionId: r.questionId,
        sessionId,
        nodeId: NODE_ID,
        userAnswer: r.userAnswer,
        sourceLocation: { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "sec-1" },
        forfeited: r.forfeited,
        createdAt: "2026-11-02T00:00:00Z",
      }));
    return {
      data: {
        recordEvidence: {
          __typename: "RecordEvidencePayload",
          evidence,
          mistakes,
          session: {
            __typename: "QuizSession",
            id: sessionId,
            planId: PLAN_ID,
            taskId: null,
            mode: "mix",
            status: "completed",
            createdAt: "2026-11-01T00:00:00Z",
            completedAt: "2026-11-02T00:00:00Z",
          },
          nodes: [
            {
              __typename: "KnowledgeNode",
              id: NODE_ID,
              title: "测试节点",
              description: null,
              optional: false, studyMark: null,
              stage: "foundations",
              order: 0,
              masteryScore: "50",
              state: "learning",
            },
          ],
          plan: { __typename: "StudyPlan", id: PLAN_ID, masteryScore: "50" },
        },
      },
    };
  },
  maxUsageCount: 5,
};

/** A location probe — the addressability assertion (the session id lands in
 * the URL under ?quicktest, AD-8). */
function LocationProbe({ onLocation }: { onLocation(search: string): void }) {
  const location = useLocation();
  useEffect(() => onLocation(location.search), [location.search, onLocation]);
  return null;
}

function renderFlow(props: { mappings: MaterialNodeMappingView[]; initialEntry?: string } = { mappings: [mappingRow()] }) {
  let lastSearch = "";
  const onLocation = (search: string) => {
    lastSearch = search;
  };
  const rendered = render(
    <LanguageProvider>
      <MockedProvider mocks={[...mappingMocks(props.mappings), createQuizSessionMock, recordEvidenceMock]}>
        <MemoryRouter initialEntries={[props.initialEntry ?? `/read/${MATERIAL_ID}`]}>
          <Routes>
            <Route
              path="/read/:materialId"
              element={
                <>
                  <LocationProbe onLocation={onLocation} />
                  <Toaster />
                  <QuickTestFlow material={materialFixture} planNodes={planNodesFixture} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
  return {
    ...rendered,
    search: () => lastSearch,
    /** Dispatches until the gate's read has LANDED and the launch opens —
     * a dispatch before the landing is the flow's honest no-op (the handler
     * re-checks the same cache). ONE dispatch per window: once a dispatch is
     * ACCEPTED, the takeover mounts within one render, but the driver stays
     * idle until its async phase flip — a blind re-dispatch in that window
     * double-fires the launch effect (seen as a double generation on a
     * loaded CI runner). So retry only when the takeover never mounted. */
    dispatchUntilLaunched: async () => {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        dispatchQuickTest(dispatchScope);
        try {
          await waitFor(
            () => expect(screen.getByTestId("quick-test-takeover")).toBeInTheDocument(),
            { timeout: 1_000 },
          );
          return;
        } catch {
          // The dispatch was the gate's no-op (the read hadn't landed) — retry.
        }
      }
      throw new Error("the quick-test gate never landed — no takeover after 15 windows");
    },
  };
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  createdSessions = [];
  recordedBatches = [];
  generatedQuizInputs = [];
  failState.fail = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuickTestFlow (T1's seam consumer; FR-14)", () => {
  it("registers the seam handler on mount and disposes it on unmount (no stale flow)", async () => {
    const { unmount } = renderFlow();

    // Registered: the dispatch reaches the handler (the gate read may still
    // be landing — the honest no-op consumed it, which IS the handler).
    expect(dispatchQuickTest(dispatchScope)).toBe(true);
    unmount();

    // Disposed: the same dispatch reports honestly false to the caller.
    expect(dispatchQuickTest(dispatchScope)).toBe(false);
  });

  it("answers an unconfirmed material's dispatch with the honest hint and no takeover", async () => {
    const toastSpy = vi.spyOn(toast, "error").mockImplementation(() => "");
    renderFlow({ mappings: [mappingRow({ status: "proposed", nodeId: null })] });

    // Let the gate land, then dispatch once — the re-check sees no confirmed row.
    await act(async () => {
      await flush(30);
    });
    expect(dispatchQuickTest(dispatchScope)).toBe(true);

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(zh("reader.quickTestGateHint")));
    expect(screen.queryByTestId("quick-test-takeover")).not.toBeInTheDocument();
    expect(createdSessions).toHaveLength(0);
  });

  it("walks dispatch → generate → session takeover, carrying the material scope and landing the session id in the URL", async () => {
    const { search, dispatchUntilLaunched } = renderFlow();

    await dispatchUntilLaunched();

    // The generation lands → the runner mounts the FIRST question.
    await waitFor(() => expect(screen.getByTestId("quiz-runner")).toBeInTheDocument(), { timeout: 3000 });

    // The seam input carried the material scope (FR-14's four-way xor member
    // + the selection's section narrowing + the Quick Test count).
    expect(generatedQuizInputs).toHaveLength(1);
    expect(generatedQuizInputs[0].materialId).toBe(MATERIAL_ID);
    expect(generatedQuizInputs[0].sectionIds).toEqual(["sec-1"]);
    expect(generatedQuizInputs[0].targetCount).toBe(4);
    // The generation wire strips the plan scope (the xor); the session OWNER
    // rides createQuizSession (the material's plan, AD-6).
    expect(generatedQuizInputs[0].planId).toBeNull();
    expect(createdSessions).toHaveLength(1);
    expect((createdSessions[0].input as Record<string, unknown>).planId).toBe(PLAN_ID);

    // Addressable (AD-8): the URL carries the session id.
    await waitFor(() => expect(search()).toContain(`quicktest=${(createdSessions[0].session as Record<string, unknown>).id}`));
  });

  it("walks the full round-trip: answer → grade → evidence + mistakes captured on the wire", async () => {
    const { dispatchUntilLaunched } = renderFlow();
    await dispatchUntilLaunched();

    // The double generates from the narrowed selection: the choice question
    // (the section title is the correct option) then the open question.
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    await screen.findByTestId("quiz-options");
    fireEvent.click(await screen.findByRole("button", { name: "集成测试" }));
    fireEvent.click(await screen.findByTestId("quiz-confirm"));
    fireEvent.click(await screen.findByTestId("quiz-next"));

    // The open question: answer without the keyword terms → the grading rule
    // lands wrong (0 hits), then to the results.
    const input = await screen.findByTestId("quiz-open-input");
    fireEvent.change(input, { target: { value: "完全没有关键术语的回答" } });
    fireEvent.click(await screen.findByTestId("quiz-confirm"));
    await screen.findByTestId("quiz-verdict", {}, { timeout: 3000 });
    fireEvent.click(await screen.findByTestId("quiz-next"));

    // The results screen — and the recorded batch on the wire: one evidence
    // row per answer, the wrong one feeding the mistakes notebook (FR-14).
    await screen.findByTestId("quiz-results");
    await waitFor(() => expect(recordedBatches).toHaveLength(1));
    const batch = recordedBatches[0];
    expect(batch.sessionId).toBe((createdSessions[0].session as Record<string, unknown>).id);
    const results = batch.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.outcome)).toEqual(["correct", "wrong"]);
    expect(results[1].forfeited).toBe(false);
  }, 15000);

  it("renders the honest terminal card for a completed ?quicktest session (never resumable)", async () => {
    const session = {
      __typename: "QuizSession",
      id: "s-done",
      planId: PLAN_ID,
      taskId: null,
      mode: "mix",
      status: "completed",
      createdAt: "2026-11-01T00:00:00Z",
      completedAt: "2026-11-02T00:00:00Z",
      questions: [],
    };
    const mocks = [
      ...mappingMocks([mappingRow()]),
      {
        request: { query: QuizSessionDocument, variables: { id: "s-done" } },
        result: { data: { quizSession: session } },
      },
    ];
    render(
      <LanguageProvider>
        <MockedProvider mocks={mocks}>
          <MemoryRouter initialEntries={[`/read/${MATERIAL_ID}?quicktest=s-done`]}>
            <Routes>
              <Route
                path="/read/:materialId"
                element={
                  <>
                    <Toaster />
                    <QuickTestFlow material={materialFixture} planNodes={planNodesFixture} />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </MockedProvider>
      </LanguageProvider>,
    );

    await screen.findByTestId("quick-test-session-terminal");
    expect(screen.getByText(zh("quiz.runner.alreadyDone"))).toBeInTheDocument();
    expect(screen.getByText(zh("reader.quickTestExit"))).toBeInTheDocument();
  });

  it("cancels a generating launch: no session is created and the reading zone returns", async () => {
    const { search, dispatchUntilLaunched } = renderFlow();

    await dispatchUntilLaunched();
    fireEvent.click(screen.getByRole("button", { name: zh("quiz.launcher.cancel") }));

    // The takeover closes; no session ever exists; the URL stays clean.
    await waitFor(() => expect(screen.queryByTestId("quick-test-takeover")).not.toBeInTheDocument());
    await act(async () => {
      await flush(800); // let any in-flight generation settle
    });
    expect(createdSessions).toHaveLength(0);
    expect(search()).not.toContain("quicktest");
  });
});

/**
 * Epic-6 integration walk (T4), re-seated on the Apollo stub harness at the
 * cutover (epic P2-8): the TASK loop with the real launches (FR-37 parity;
 * FR-18/19) walked across the same seams as the plan-loop walk — Task Home's
 * quick-action tiles through the QuizLauncher dialog (task-scoped: no scope
 * picker) → the AI seam's generation over the task's single material → the
 * persisted session carried in the URL (planId null, taskId set — AD-6) → a
 * choice-mode run answered to completion → the atomic evidence batch on the
 * TASK's own node (auto-mistakes none, all correct) → the results screen's
 * mastery rows rendered from SERVER scores (AD-14: the mutation's
 * refetchQueries sweep replaced the retired TanStack invalidation — the walk
 * reads the swept cache and the fresh rings on Task Home AND Plans Home) → a
 * sibling plan untouched (mastery never bleeds) → the flashcards leg (launcher
 * dialog → study → ratings persist, zero evidence — ADR-0001 story 26).
 * Prior art: use-quiz-session.test.tsx + plan-quiz-loop.integration.test.tsx.
 *
 * ADR-0001 numbers asserted: 2 sections × choice mode = 2 questions, both
 * attributed to the task's single node (AD-6); both correct → round 100%, but
 * the node sits BELOW the 3-record gate → the honest cap: the row reads 99%
 * and the cap note names the gate. The sibling plan's rollup stays 0 (uncovered).
 */
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { mapEvidence } from "@/api/mappers";
import type { MaterialSection } from "@/domain/entities";
import { computeNodeScore, computePlanRollup, computeTaskRollup, getNodeState } from "@/domain/mastery";
import PlansHomePage from "@/features/plans/PlansHomePage";
import TaskHomePage from "@/features/tasks/TaskHomePage";
import TaskFlashcardsPage from "@/pages/TaskFlashcardsPage";
import TaskQuizPage from "@/pages/TaskQuizPage";
import {
  createHarnessState,
  createStubClient,
  echoQuestion,
  makeStubWrapper,
  type HarnessState,
  type EchoFixture,
} from "@/test/apollo-harness";
import {
  AllEvidenceDocument,
  AttachMaterialDocument,
  CreateFlashcardsDocument,
  CreatePlanDocument,
  CreateQuizSessionDocument,
  CreateTaskDocument,
  FlashcardsByMaterialDocument,
  MaterialsDocument,
  PlanDocument,
  PlansDocument,
  QuizSessionDocument,
  RateFlashcardDocument,
  ReadingProgressListDocument,
  RecordEvidenceDocument,
  TaskDocument,
  TasksDocument,
} from "@/types/graphql";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

const CREATED = "2026-11-01T00:00:00Z";

/** Every interaction entry AWAITS its target: a launch's URL flip swaps the
 * session id and the shell honestly blanks while the new session reads (one
 * stub tick) — a synchronous click would race that tick. */
async function pickOption(text: string) {
  fireEvent.click(await screen.findByRole("button", { name: text }, { timeout: 2500 }));
  fireEvent.click(await screen.findByTestId("quiz-confirm"));
}

/** The echo handlers widen the harness's object-only OperationHandler to the
 * wire-record EchoFixture: list roots return ARRAYS and handler inputs are the
 * server's own variable shapes — payloads stay structural, checked on read by
 * the mappers, never by the fixture types. */
type EchoHandler = (variables: EchoFixture, state: HarnessState) => unknown;

interface World {
  client: ReturnType<typeof createStubClient>;
  state: HarnessState;
  handlers: Record<string, EchoHandler>;
}

/** The echo server the walk rides: every query the task/plan surfaces watch,
 * plus the quiz + flashcard mutation echoes — all deriving payloads from the
 * captured server state. The score-bearing rows compute their numbers from the
 * harness evidence with the REAL domain functions — the stub plays by the
 * api's rules (AD-14: the client renders, never recomputes). */
function makeWorld(): World {
  const server = {
    plan: null as EchoFixture | null,
    nodes: [] as EchoFixture[],
    materials: [] as EchoFixture[],
    tasks: [] as EchoFixture[],
    cards: [] as EchoFixture[],
  };
  const state: HarnessState = createHarnessState();
  const nodeEvidence = (nodeId: string) => state.evidence.filter((e) => e.nodeId === nodeId).map(mapEvidence);
  const nodeRow = (row: EchoFixture) => ({
    ...row,
    masteryScore: String(computeNodeScore(nodeEvidence(row.id), new Date())),
    state: getNodeState(nodeEvidence(row.id), new Date()),
  });
  const handlers: Record<string, EchoHandler> = {
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
        downloadUrl: null,
      };
      server.materials.push(material);
      return { material };
    },
    // createTask back-links the material and auto-creates the exactly-one
    // node titled from the material (AD-6)
    CreateTask: (variables) => {
      const input = variables.input as EchoFixture;
      const material = server.materials.find((m) => m.id === input.materialId)!;
      const task = { __typename: "StudyTask", id: "task-echo-1", materialId: material.id, nodeId: "node-task-1", createdAt: CREATED };
      const node = nodeRow({ __typename: "KnowledgeNode", id: task.nodeId, planId: null, taskId: task.id, stage: null, title: material.title, order: 0, createdAt: CREATED });
      material.taskId = task.id;
      server.tasks.push(task);
      server.nodes.push(node);
      return { task: { id: task.id, materialId: task.materialId, nodeId: task.nodeId, createdAt: task.createdAt }, node };
    },
    Task: (variables) => {
      const task = server.tasks.find((t) => t.id === variables.id);
      if (!task) return null;
      const node = server.nodes.find((n) => n.taskId === task.id)!;
      return { id: task.id, materialId: task.materialId, nodeId: task.nodeId, createdAt: task.createdAt, node: nodeRow(node) };
    },
    Tasks: () =>
      server.tasks.map((task) => ({
        id: task.id,
        materialId: task.materialId,
        nodeId: task.nodeId,
        createdAt: task.createdAt,
        node: nodeRow(server.nodes.find((n) => n.taskId === task.id)!),
      })),
    // the AD-6 isolation control: a sibling plan sharing NOTHING with the task
    CreatePlan: (variables) => {
      const input = variables.input as EchoFixture;
      const plan = { __typename: "StudyPlan", id: "plan-echo-1", topic: input.topic, goal: input.goal ?? null, createdAt: CREATED, masteryScore: "0" };
      const nodes = (input.nodes as EchoFixture[]).map((n, i) =>
        nodeRow({ __typename: "KnowledgeNode", id: `node-plan-${i + 1}`, planId: plan.id, taskId: null, stage: n.stage ?? null, title: n.title, order: i, createdAt: CREATED }),
      );
      server.plan = plan;
      server.nodes.push(...nodes);
      return { plan, nodes };
    },
    Plan: (variables) => {
      if (!server.plan || server.plan.id !== variables.id) return null;
      const byNode = Object.fromEntries(server.nodes.filter((n) => n.planId === variables.id).map((n) => [n.id, nodeEvidence(n.id)]));
      return {
        __typename: "StudyPlan",
        ...server.plan,
        masteryScore: String(computePlanRollup(byNode, new Date())),
        nodes: server.nodes.filter((n) => n.planId === variables.id).map(nodeRow),
        materials: server.materials.filter((m) => m.planId === variables.id).map((m) => ({ ...m, sections: undefined })),
      };
    },
    Plans: () =>
      server.plan
        ? [
            {
              ...server.plan,
              masteryScore: String(
                computePlanRollup(
                  Object.fromEntries(server.nodes.filter((n) => n.planId === server.plan!.id).map((n) => [n.id, nodeEvidence(n.id)])),
                  new Date(),
                ),
              ),
            },
          ]
        : [],
    Materials: (variables) =>
      server.materials.filter((m) => (variables.planId ? m.planId === variables.planId : variables.taskId ? m.taskId === variables.taskId : true)),
    ReadingProgressList: () => [],
    ReadingProgress: () => {
      // no stored position in this walk — honest NOT_FOUND: the link errors,
      // data stays undefined, and the row reads as absent (the harness cannot
      // express a null row: a null handler return is substituted with a
      // minimal { __typename } payload the mapper would choke on)
      throw new Error("not found: reading progress");
    },
    AllEvidence: () => state.evidence,
    QuizSession: (variables) => {
      const session = state.sessions.find((s) => s.id === variables.id);
      if (!session) throw new Error("not found: quiz session"); // honest NOT_FOUND — data stays undefined
      return session;
    },
    FlashcardsByMaterial: (variables) => server.cards.filter((c) => c.materialId === variables.materialId),
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
        questions, // stored for the shell's hydrate + the evidence attribution
      };
      state.sessions.push(session);
      return { session, questions };
    },
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
      return { evidence, mistakes, session };
    },
    // flashcards (FR-19): one card per section; ratings persist on the card
    // and NEVER create evidence (ADR-0001 story 26)
    CreateFlashcards: (variables) => {
      const input = variables.input as EchoFixture;
      const cards = (input.cards as EchoFixture[]).map((c, i) => {
        const row = {
          __typename: "Flashcard",
          id: `card-echo-${server.cards.length + i + 1}`,
          materialId: input.materialId,
          nodeId: input.nodeId ?? null,
          front: c.front,
          back: c.back,
          difficulty: null,
          createdAt: CREATED,
        };
        server.cards.push(row);
        return row;
      });
      return { cards };
    },
    RateFlashcard: (variables) => {
      const input = variables.input as EchoFixture;
      const card = server.cards.find((c) => c.id === input.id)!;
      card.difficulty = input.difficulty;
      return { flashcard: { __typename: "Flashcard", id: card.id, difficulty: card.difficulty } };
    },
  };
  return { client: createStubClient(handlers, state), state, handlers };
}

function renderApp(world: World, initialEntry: string) {
  return render(
    <LanguageProvider>
      {makeStubWrapper(world.client)({
        children: (
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <Toaster />
              <Routes>
                <Route path="/task/:id" element={<TaskHomePage />} />
                <Route path="/task/:id/quiz" element={<TaskQuizPage />} />
                <Route path="/task/:id/flashcards" element={<TaskFlashcardsPage />} />
                <Route path="/plans" element={<PlansHomePage />} />
                <Route path="/plan/:id" element={<p data-testid="plan-landing" />} />
                <Route path="/plan/new" element={<p data-testid="plan-create-landing" />} />
                <Route path="/task/new" element={<p data-testid="task-create-landing" />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        ),
      })}
    </LanguageProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("task quiz loop — Task Home tile → task quiz → evidence on the task's node → fresh everywhere (FR-37; AD-6; ADR-0001; AD-14)", () => {
  it("walks the whole loop at page level with exact numbers and no mastery bleed", async () => {
    const world = makeWorld();
    const client = world.client;

    // -- the task: one material (parsed), one auto-owned node (AD-6) --
    await client.mutate({
      mutation: AttachMaterialDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), title: "复习讲义.md", kind: "markdown", sizeBytes: 64, planId: null, taskId: null, sections, parseState: "parsed" } },
    });
    const created = await client.mutate({ mutation: CreateTaskDocument, variables: { input: { clientUuid: crypto.randomUUID(), materialId: "m-echo-1" } } });
    const task = created.data!.createTask.task;
    const node = created.data!.createTask.node;
    // -- the sibling plan (the isolation control) --
    const plan = await client.mutate({
      mutation: CreatePlanDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), topic: "别的计划", goal: null, nodes: [{ title: "计划节点", stage: "核心" }] } },
    });
    const planNode = plan.data!.createPlan.nodes[0];

    renderApp(world, `/task/${task.id}`);

    // -- Task Home: ring uncovered, tiles real --
    expect(await screen.findByRole("heading", { name: "复习讲义.md" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 0 }) })).toBeInTheDocument();

    // -- the quiz tile opens the task-scoped QuizLauncher dialog (mode only) --
    fireEvent.click(screen.getByTestId("task-quiz-tile"));
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument(); // the material IS the scope

    // -- choice mode → generating → the runner (the session rides in the URL) --
    fireEvent.click(screen.getByTestId("quiz-mode-choice"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zhVars("quiz.launcher.generating", { n: 1 }))).toBeInTheDocument();
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });

    // the persisted session is TASK-owned (AD-6): planId null, taskId set
    const session = world.state.sessions[world.state.sessions.length - 1];
    expect(session.planId).toBeNull();
    expect(session.taskId).toBe(task.id);
    expect(session.status).toBe("active");
    const questions = session.questions as EchoFixture[];
    expect(questions).toHaveLength(2); // 2 sections × choice mode
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([node.id])); // the TASK's node, every question

    // -- both correct (the generator's correct option is its section title) --
    await pickOption("集成测试");
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await pickOption("需求工程");
    fireEvent.click(await screen.findByTestId("quiz-next")); // the last verdict → results

    // -- the results: exact ADR-0001 numbers, rows rendered from SERVER scores --
    const results = await screen.findByTestId("quiz-results", {}, { timeout: 3000 });
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 2, p: 0, n: 2 }));
    expect(results.textContent).toContain("100%"); // the round's score
    await waitFor(() => expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 2 })), { timeout: 3000 });
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 99 }))).toHaveLength(1); // below the gate: the honest cap
    expect(screen.getByText(zhVars("quiz.cap99Note", { n: 3 }))).toBeInTheDocument();
    expect(screen.getByText(zh("quiz.noMistakes"))).toBeInTheDocument();

    // -- the harness agrees: evidence lands on the TASK's node only --
    const evidence = world.state.evidence;
    expect(evidence).toHaveLength(2);
    expect(evidence.every((e) => e.nodeId === node.id)).toBe(true);
    expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
    const nodeRecords = evidence.map(mapEvidence);
    expect(computeNodeScore(nodeRecords, new Date())).toBe(99); // capped — raw would be 100
    expect(computeTaskRollup(nodeRecords, new Date())).toBe(99); // the task rollup = its single node
    expect(getNodeState(nodeRecords, new Date())).toBe("partial"); // ≥80 but the gate unmet
    expect(world.state.mistakes).toHaveLength(0); // all correct → no mistakes
    expect(session.status).toBe("completed");

    // -- the sibling plan is untouched (mastery never bleeds, AD-6) --
    expect(world.state.evidence.filter((e) => e.nodeId === planNode.id)).toHaveLength(0);
    expect(computePlanRollup({ [planNode.id]: [] }, new Date())).toBe(0);

    // -- the refetch sweep fired: the mutation's refetchQueries replaced the
    //    retired TanStack invalidation — the swept cache holds the fresh score --
    await waitFor(() => {
      const swept = client.readQuery({ query: TaskDocument, variables: { id: task.id } });
      expect(swept?.task.node.masteryScore).toBe("99");
    }, { timeout: 3000 });

    // -- Task Home reads the FRESH score (the sweep already updated the cache) --
    fireEvent.click(await screen.findByTestId("quiz-back-to-plan")); // labelled 「返回任务」
    expect(await screen.findByRole("heading", { name: "复习讲义.md" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument();
    expect(screen.getAllByText("99%").length).toBeGreaterThan(0); // the node row's fresh number

    // -- Plans Home's Study Tasks section reads the FRESH score too --
    fireEvent.click(await screen.findByRole("button", { name: zh("tasks.backToPlans") }));
    expect(await screen.findByText(zh("tasks.eyebrow"))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument(); // the task row's ring
    // and the sibling plan's card still reads its untouched 0 rollup
    expect(screen.getAllByRole("img", { name: zhVars("plans.masteryAria", { n: 0 }) }).length).toBeGreaterThan(0);

    // -- the flashcards leg: launcher dialog → study → ratings never move evidence --
    fireEvent.click(await screen.findByRole("link", { name: /复习讲义\.md/ })); // the task row → Task Home
    expect(await screen.findByTestId("task-flashcards-tile")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("task-flashcards-tile")); // no cards yet → the launcher dialog
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    const study = await screen.findByTestId("flashcards-study", {}, { timeout: 3000 });
    expect(study).toBeInTheDocument(); // onCreated navigated to the study route

    // the generated deck: one card per section (the seam's material-section order)
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 2 }));
    fireEvent.keyDown(window, { key: " " }); // flip card 1
    expect(screen.getByTestId("flashcards-back")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("flashcards-rate-hard")); // rating advances to card 2
    await screen.findAllByText(zhVars("flashcards.study.progress", { i: 2, n: 2 }));
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium")); // the last card rated → summary
    const summary = await screen.findByTestId("flashcards-summary");
    expect(summary.textContent).toContain(zhVars("flashcards.summary.breakdown", { n: 2, h: 1, m: 1, e: 0 }));

    // zero evidence from ratings (ADR-0001 story 26): the captured rows are untouched
    expect(world.state.evidence).toHaveLength(2);

    // -- back on Task Home: the deck exists (「继续学习」), the ring never moved --
    fireEvent.click(screen.getByTestId("flashcards-back-to-plan")); // labelled 「返回任务」
    const tile = await screen.findByTestId("task-flashcards-tile");
    expect(tile.textContent).toContain(zh("flashcards.tileContinue"));
    expect(tile.textContent).toContain(zhVars("flashcards.tileContinueDesc", { n: 2 }));
    expect(screen.getByRole("img", { name: zhVars("plans.masteryAria", { n: 99 }) })).toBeInTheDocument();
    expect(world.state.evidence).toHaveLength(2); // still exactly the quiz's two records
  });
});

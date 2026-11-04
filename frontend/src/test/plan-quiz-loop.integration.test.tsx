/**
 * Epic-6 integration walk (T2), re-seated on the Apollo stub harness at the
 * cutover (epic P2-8): the PLAN QUIZ loop (FR-18) walked across the same seams
 * as the epic-5 task loop — the real PlanQuizPage (QuizSessionPage shell +
 * inline QuizLauncher) → the AI seam's generation over the attached material's
 * parsed sections → the persisted session carried in the URL → answering
 * across BOTH modes in one interleaved mix run → the atomic evidence batch
 * (recordEvidence at completion, auto-mistakes) → the results screen's mastery
 * rows rendered from SERVER scores (AD-14: the mutation's refetch sweep
 * re-runs the Plan/AllEvidence queries, and the echo server derives the
 * updated scores from the harness evidence with the REAL domain functions —
 * the golden-vector source; AD-14 only removed the domain from RENDER paths) →
 * a reload simulation resuming the session honestly through a fresh Apollo
 * cache over the same server state. Prior art: use-quiz-session.test.tsx.
 *
 * ADR-0001 numbers asserted (the worked sequence below — 2 plan nodes, the
 * generator round-robins node attribution: q1→n1, q2→n2, q3→n1, q4→n2):
 *   - mix interleaves choice and open, generator order (choice, open ×2);
 *   - n1 (two corrects): raw 100 but BELOW the 3-record gate → 99 with the
 *     honest cap note — the gate gates the score itself (ADR-0001 amendment);
 *   - n2 (two partials): round(100 × 0.5) = 50, an honest sub-cap partial;
 *   - round score = round(100 × (1 + 0.5 + 1 + 0.5) / 4) = 75;
 *   - partial ≠ wrong → zero mistakes; evidence lands exactly once, at
 *     completion, with per-question node attribution (AD-6).
 */
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { mapEvidence } from "@/api/mappers";
import type { MaterialSection } from "@/domain/entities";
import { computeNodeScore, computePlanRollup, getNodeState } from "@/domain/mastery";
import PlanQuizPage from "@/pages/PlanQuizPage";
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
  CreatePlanDocument,
  CreateQuizSessionDocument,
  MaterialsDocument,
  PlanDocument,
  QuizSessionDocument,
  RecordEvidenceDocument,
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

/** Every interaction entry AWAITS its target: a retake's URL flip swaps the
 * session id and the shell honestly blanks while the new session reads (one
 * stub tick) — a synchronous click would race that tick. */
async function pickOption(text: string) {
  fireEvent.click(await screen.findByRole("button", { name: text }, { timeout: 2500 }));
  fireEvent.click(await screen.findByTestId("quiz-confirm"));
}

/** Type an open answer naming ONE keyword fragment → the partial verdict (the seam's 1-hit rule). */
async function answerPartial(fragment: string) {
  fireEvent.change(await screen.findByTestId("quiz-open-input"), { target: { value: fragment } });
  fireEvent.click(await screen.findByTestId("quiz-confirm"));
  expect(screen.getByTestId("quiz-grading")).toHaveTextContent(zh("quiz.grading"));
  await screen.findByTestId("quiz-verdict", {}, { timeout: 2500 });
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
  nodeEvidence: (nodeId: string) => ReturnType<typeof mapEvidence>[];
}

/** The echo server the walk rides: the pages' watched queries + the quiz
 * mutation echoes, all deriving payloads from the captured server state. The
 * score-bearing rows compute their numbers from the harness evidence with the
 * REAL domain functions — the stub plays by the api's rules (AD-14). */
function makeWorld(): World {
  const server = {
    plan: null as EchoFixture | null,
    nodes: [] as EchoFixture[],
    materials: [] as EchoFixture[],
  };
  const state: HarnessState = createHarnessState();
  const nodeEvidence = (nodeId: string) => state.evidence.filter((e) => e.nodeId === nodeId).map(mapEvidence);
  const nodeRow = (row: EchoFixture) => ({
    ...row,
    masteryScore: String(computeNodeScore(nodeEvidence(row.id), new Date())),
    state: getNodeState(nodeEvidence(row.id), new Date()),
  });
  const handlers: Record<string, EchoHandler> = {
    CreatePlan: (variables) => {
      const input = variables.input as EchoFixture;
      const plan = { __typename: "StudyPlan", id: "plan-echo-1", topic: input.topic, goal: input.goal ?? null, createdAt: CREATED, masteryScore: "0" };
      const nodes = (input.nodes as EchoFixture[]).map((n, i) =>
        nodeRow({ __typename: "KnowledgeNode", id: `node-${i + 1}`, planId: plan.id, taskId: null, stage: n.stage ?? null, title: n.title, order: i, createdAt: CREATED }),
      );
      server.plan = plan;
      server.nodes.push(...nodes);
      return { plan, nodes };
    },
    // the parse already landed (T2's entry contract — the eager parse's
    // write-back), so the launcher's sourcing honesty sees a parsed material
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
        parseState: input.parseState ?? "pending",
        parseFailureReason: input.parseFailureReason ?? null,
        sections: (input.sections as EchoFixture[]).map((s) => ({ __typename: "MaterialSection", ...s })),
        createdAt: CREATED,
        downloadUrl: null,
      };
      server.materials.push(material);
      return { material };
    },
    Plan: (variables) => {
      if (!server.plan || server.plan.id !== variables.id) return null;
      const byNode = Object.fromEntries(server.nodes.map((n) => [n.id, nodeEvidence(n.id)]));
      return {
        __typename: "StudyPlan",
        ...server.plan,
        masteryScore: String(computePlanRollup(byNode, new Date())),
        nodes: server.nodes.map(nodeRow),
        materials: server.materials.map((m) => ({ ...m, sections: undefined })), // summaries carry no sections
      };
    },
    Materials: (variables) =>
      server.materials.filter((m) => (variables.planId ? m.planId === variables.planId : variables.taskId ? m.taskId === variables.taskId : true)),
    AllEvidence: () => state.evidence,
    QuizSession: (variables) => state.sessions.find((s) => s.id === variables.id) ?? null,
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
  };
  return { client: createStubClient(handlers, state), state, handlers, nodeEvidence };
}

function renderAt(world: World, path: string) {
  return render(
    <LanguageProvider>
      {makeStubWrapper(world.client)({
        children: (
          <TooltipProvider>
            <MemoryRouter initialEntries={[path]}>
              <Toaster />
              <Routes>
                <Route path="/plan/:id" element={<p data-testid="plan-home-landing" />} />
                <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
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

describe("plan quiz loop — inline launch → mix quiz → evidence → server scores → reload (FR-18; ADR-0001; AD-6; AD-14)", () => {
  it("walks the whole loop at page level with exact server-scored numbers", async () => {
    const world = makeWorld();
    const created = await world.client.mutate({
      mutation: CreatePlanDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }, { title: "需求分析", stage: "核心" }] } },
    });
    const planId = created.data!.createPlan.plan.id;
    const nodeIds = created.data!.createPlan.nodes.map((n) => n.id);
    await world.client.mutate({
      mutation: AttachMaterialDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), title: "复习讲义.md", kind: "markdown", sizeBytes: 64, planId, taskId: null, sections, parseState: "parsed" } },
    });

    const ui = renderAt(world, `/plan/${planId}/quiz`);

    // -- the inline launcher: mix mode → generating is visible → launch --
    await screen.findByTestId("quiz-launcher"); // the plan/material reads settle first
    fireEvent.click(screen.getByTestId("quiz-mode-mix"));
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zhVars("quiz.launcher.generating", { n: 1 }))).toBeInTheDocument();

    // the session the launcher persisted carries this plan's id — and the URL
    // now names it, so a reload can resume (spec decision 7)
    const runner = await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    expect(runner).toBeInTheDocument();
    // a fresh launch is not a resume — no 「已恢复」 note (T6: the launcher
    // marks the session fresh; the shell consumes the marker)
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument();
    const session = world.state.sessions[world.state.sessions.length - 1];
    expect(session.planId).toBe(planId);
    expect(session.status).toBe("active");
    expect(session.questions).toHaveLength(4);

    // -- one interleaved mix run: choice, open, choice, open (generator order) --
    expect(screen.getByTestId("quiz-progress")).toHaveTextContent(zhVars("quiz.question", { i: 1, n: 4 }));

    await pickOption("集成测试"); // q1 choice → correct, auto-graded
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerPartial("集成"); // q2 open → 1 keyword hit → partial
    fireEvent.click(await screen.findByTestId("quiz-next"));

    await pickOption("需求工程"); // q3 choice → correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerPartial("需求"); // q4 open → partial — the LAST answer completes the run
    fireEvent.click(await screen.findByTestId("quiz-next")); // 查看结果

    // -- the results screen: the moment evidence lands (FR-3). The sweep (the
    //    mutation's refetchQueries) re-runs Plan/AllEvidence — the rows then
    //    read the SERVER's updated scores. --
    const results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(results.textContent).toContain(zhVars("quiz.resultsSub", { c: 2, p: 2, n: 4 }));
    expect(results.textContent).toContain("75%");
    await waitFor(() => expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 4 })), { timeout: 3000 });

    // mastery rows through the selectors — the ADR-0001 exact numbers, now
    // SERVER scores (AD-14): n1 capped at 99 below the gate, n2 an honest 50
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 99 }))).toHaveLength(1);
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 50 }))).toHaveLength(1);
    // the cap note rides the api's 99 cap — only the capped node claims it
    expect(screen.getAllByText(zhVars("quiz.cap99Note", { n: 3 }))).toHaveLength(1);
    expect(screen.getByText(zh("quiz.noMistakes"))).toBeInTheDocument(); // partial ≠ wrong

    // -- the harness agrees with the screen --
    const evidence = world.state.evidence;
    expect(evidence).toHaveLength(4);
    expect(evidence.map((e) => e.outcome)).toEqual(["correct", "partial", "correct", "partial"]);
    expect(evidence.filter((e) => e.nodeId === nodeIds[0])).toHaveLength(2);
    expect(evidence.filter((e) => e.nodeId === nodeIds[1])).toHaveLength(2);
    expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
    expect(world.state.mistakes).toHaveLength(0);
    expect(session.status).toBe("completed");

    // -- reload simulation: a fresh Apollo cache over the same server state —
    //    the completed session's URL is no longer resumable — the honest card --
    ui.unmount();
    const reloaded = makeWorldFrom(world);
    const done = renderAt(reloaded, `/plan/${planId}/quiz?session=${session.id}`);
    expect(await done.findByText(zh("quiz.runner.alreadyDone"))).toBeInTheDocument();
    done.unmount();
  });
});

/** A fresh client over the SAME server state (the reload's new Apollo cache). */
function makeWorldFrom(world: World): World {
  return { ...world, client: createStubClient(world.handlers, world.state) };
}

/**
 * The walk's second leg (T6): the ADR-0001 numbers the first walk's 2-record
 * chain cannot reach — the anti-inflation gate OPENING (mastered = ≥ 80 AND
 * ≥ 3 records) and the last-5 WINDOW evicting aged-out evidence. Three
 * generated mix rounds over the same plan via 再来一轮 (the honest retake —
 * fresh session ids, near-identical questions), launched INLINE on the quiz
 * route so the mount keeps its retake params. The generator is deterministic:
 * every round is q1 choice→n1, q2 open→n2, q3 choice→n1, q4 open→n2, and an
 * open answer carrying the section TITLE hits ≥ 2 keywords → correct, a
 * one-bigram answer → partial, an unrelated one → wrong.
 */
describe("plan quiz loop — retake chain: the gate opens, then the window evicts (ADR-0001 exact numbers)", () => {
  /** Type an open answer and wait through the grading beat to the verdict. */
  async function answerOpen(text: string) {
    fireEvent.change(await screen.findByTestId("quiz-open-input"), { target: { value: text } });
    fireEvent.click(await screen.findByTestId("quiz-confirm"));
    expect(screen.getByTestId("quiz-grading")).toHaveTextContent(zh("quiz.grading"));
    await screen.findByTestId("quiz-verdict", {}, { timeout: 2500 });
  }

  it("walks three rounds: 99 capped → 100 mastered at the 3-record gate → the last-5 window drags both nodes back down", { timeout: 30000 }, async () => {
    const world = makeWorld();
    const created = await world.client.mutate({
      mutation: CreatePlanDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }, { title: "需求分析", stage: "核心" }] } },
    });
    const planId = created.data!.createPlan.plan.id;
    const nodeIds = created.data!.createPlan.nodes.map((n) => n.id);
    await world.client.mutate({
      mutation: AttachMaterialDocument,
      variables: { input: { clientUuid: crypto.randomUUID(), title: "复习讲义.md", kind: "markdown", sizeBytes: 64, planId, taskId: null, sections, parseState: "parsed" } },
    });

    renderAt(world, `/plan/${planId}/quiz`);

    // -- ROUND 1 (mix): correct, partial, correct, partial — the gate closed --
    fireEvent.click(await screen.findByTestId("quiz-launcher-start"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    const firstId = world.state.sessions[world.state.sessions.length - 1].id;
    expect(firstId).toBeTruthy();

    await pickOption("集成测试"); // q1 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("集成"); // q2 → n2 partial (1 keyword hit)
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await pickOption("需求工程"); // q3 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("需求"); // q4 → n2 partial — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next")); // 查看结果

    let results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    // the chain's starting point — n1 sits under the 3-record gate, so its row
    // carries the honest cap; n2's 50 is an honest sub-cap partial (no note)
    await waitFor(() => expect(results.textContent).toContain(zhVars("quiz.evidenceLogged", { n: 4 })), { timeout: 3000 });
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 99 }))).toHaveLength(1); // n1: c,c capped
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 50 }))).toHaveLength(1); // n2: p,p
    expect(screen.getAllByText(zhVars("quiz.cap99Note", { n: 3 }))).toHaveLength(1);
    expect(screen.getByTestId("quiz-retake")).toBeInTheDocument(); // the inline launch keeps its params

    // -- ROUND 2 (再来一轮, all correct): the gate OPENS at the 3rd/4th record --
    fireEvent.click(screen.getByTestId("quiz-retake"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    const secondId = world.state.sessions[world.state.sessions.length - 1].id;
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId); // a fresh generated session, never a replay
    expect(world.state.sessions).toHaveLength(2);

    await pickOption("集成测试"); // q1 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("集成测试"); // q2 → n2 CORRECT (the section title = 2 keyword hits)
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await pickOption("需求工程"); // q3 → n1 correct
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("需求工程"); // q4 → n2 correct — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next"));

    results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(screen.getByTestId("quiz-score").textContent).toBe("100%"); // the round's score
    // per-node SERVER scores after the sweep: n1 reaches 100 now that the gate
    // is met (4 records ≥ 3), n2 rides its window mean to 75
    await waitFor(() => expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 100 }))).toHaveLength(1), { timeout: 3000 });
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 75 }))).toHaveLength(1);
    // the cap note is gone — no node is capped anymore
    expect(screen.queryByText(zhVars("quiz.cap99Note", { n: 3 }))).not.toBeInTheDocument();
    // the domain seam agrees — mastered = ≥ 80 AND ≥ 3 records (both true only now);
    // the TS domain stays the golden-vector source the api's scores are pinned to
    const evidenceNow = () => world.state.evidence.map(mapEvidence);
    expect(computeNodeScore(evidenceNow().filter((e) => e.nodeId === nodeIds[0]), new Date())).toBe(100);
    expect(getNodeState(evidenceNow().filter((e) => e.nodeId === nodeIds[0]), new Date())).toBe("mastered");
    expect(computeNodeScore(evidenceNow().filter((e) => e.nodeId === nodeIds[1]), new Date())).toBe(75);
    expect(getNodeState(evidenceNow().filter((e) => e.nodeId === nodeIds[1]), new Date())).toBe("partial"); // 75 < 80

    // -- ROUND 3 (再来一轮, all wrong): the last-5 WINDOW evicts round-1's corrects --
    fireEvent.click(screen.getByTestId("quiz-retake"));
    await screen.findByTestId("quiz-runner", {}, { timeout: 3000 });
    expect(world.state.sessions).toHaveLength(3);

    await pickOption("需求工程"); // q1 → n1 WRONG
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("没读过材料"); // q2 → n2 wrong (0 keyword hits)
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await pickOption("集成测试"); // q3 → n1 wrong
    fireEvent.click(await screen.findByTestId("quiz-next"));
    await answerOpen("没读过材料"); // q4 → n2 wrong — completes the run
    fireEvent.click(await screen.findByTestId("quiz-next"));

    results = await screen.findByTestId("quiz-results", {}, { timeout: 2500 });
    expect(screen.getByTestId("quiz-score").textContent).toBe("0%");
    // window-5 eviction, exact: n1's chronology c,c,c,c,w,w scores the LAST
    // FIVE (c,c,c,w,w = 60) — the un-windowed mean (4/6 ≈ 67%) never renders
    await waitFor(() => expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 60 }))).toHaveLength(1), { timeout: 3000 });
    expect(screen.getAllByLabelText(zhVars("quiz.moveAria", { score: 50 }))).toHaveLength(1); // n2: last five p,c,c,w,w
    expect(screen.queryByText(zhVars("quiz.cap99Note", { n: 3 }))).not.toBeInTheDocument();
    // recent wrongs drag the STATE back down too: 60 < 80 → partial again
    expect(computeNodeScore(evidenceNow().filter((e) => e.nodeId === nodeIds[0]), new Date())).toBe(60);
    expect(getNodeState(evidenceNow().filter((e) => e.nodeId === nodeIds[0]), new Date())).toBe("partial");
    expect(computeNodeScore(evidenceNow().filter((e) => e.nodeId === nodeIds[1]), new Date())).toBe(50);
    // the harness agrees with the screen across the whole chain
    expect(world.state.evidence).toHaveLength(12); // 3 rounds × 4 answers
    expect(world.state.evidence.filter((e) => e.nodeId === nodeIds[0])).toHaveLength(6); // c,c,c,c,w,w
    expect(world.state.evidence.filter((e) => e.nodeId === nodeIds[1])).toHaveLength(6); // p,p,c,c,w,w
    for (const s of world.state.sessions) expect(s.status).toBe("completed");
    // the wrong round auto-logged its mistakes — the mutation's atomic tail
    expect(world.state.mistakes).toHaveLength(4);
  });
});

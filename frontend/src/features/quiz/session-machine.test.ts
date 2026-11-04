import { describe, expect, it } from "vitest";
import type { GradedAnswer } from "@/ai/types";
import type { Question, QuizSession } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { AppError } from "@/lib/app-error";
import {
  abandonRun,
  applyOpenGrading,
  forfeitCurrent,
  hydrateQuizRun,
  quizResults,
  releaseGrading,
  requestHint,
  selectOption,
  startQuizRun,
  submitCurrent,
  typeOpenAnswer,
  type QuizRunState,
} from "./session-machine";

/**
 * Epic-6 T1: the quiz session state machine tested directly at the new seam
 * (spec testing seam 1; prior art: the domain pure-function tests). Full
 * generate → answer → submit/grade → forfeit → complete paths for choice,
 * open (incl. the grading wait), and mix; the attempt gate asserted via
 * machine OUTPUTS (narrowed views carry no answer/rationale/verdict keys, and
 * the serialized run state carries no answer text — the machine's private
 * source-question store rides on a symbol key that never serializes).
 * ADR-0001 outcome values (correct 1 / partial 0.5 / forfeit-wrong 0) are
 * read through MASTERY_CONFIG — no duplicated arithmetic here either.
 */

const RATIONALE = "the rationale sentence (explanation)";
const SECRET_KEYWORDS = ["契约", "验证"];

const choiceQ = (over: Partial<Question> = {}): Question => ({
  sessionId: "s-1",
  id: "q-choice",
  nodeId: "node-a",
  kind: "choice",
  prompt: "Which statement holds?",
  // correct answer deliberately NOT at index 0 — position must never hint
  options: ["a wrong option", "the correct option", "another wrong option"],
  correctOptionIndex: 1,
  sourceMaterialId: "m-1",
  sourceSectionId: "page-7",
  explanation: RATIONALE,
  ...over,
});

const openQ = (over: Partial<Question> = {}): Question => ({
  sessionId: "s-1",
  id: "q-open",
  nodeId: "node-a",
  kind: "open",
  prompt: "请解释这个概念。",
  sourceMaterialId: "m-1",
  sourceSectionId: "sec-1",
  keywords: SECRET_KEYWORDS,
  explanation: RATIONALE,
  ...over,
});

function mixQuestions(): Question[] {
  return [
    choiceQ({ id: "q1-choice", nodeId: "node-a" }),
    openQ({ id: "q2-open", nodeId: "node-b" }),
    choiceQ({ id: "q3-choice", nodeId: "node-b", correctOptionIndex: 2 }),
  ];
}

const graded = (outcome: GradedAnswer["outcome"]): GradedAnswer => ({
  outcome,
  rationale: `graded against the material — ${outcome}`,
  citation: { locator: { kind: "markdown", sectionId: "sec-1" }, quote: "the source sentence" },
});

/** The attempt gate, asserted on machine OUTPUTS only (AC 2): masked views
 * carry no answer/rationale/verdict key and serialize no answer prose (options
 * are legitimately visible — which ONE is correct is not). Revealed views are
 * skipped: the gate opened for them at submit/grade/forfeit. */
const GATED_KEYS = [
  "correctOptionIndex",
  "explanation",
  "keywords",
  "outcome",
  "outcomeValue",
  "userAnswer",
  "forfeited",
  "grading",
] as const;

const isRevealed = (status: string) =>
  status === "submitted" || status === "graded" || status === "forfeited";

function expectGateHolds(state: QuizRunState) {
  for (const view of state.views) {
    if (isRevealed(view.status)) continue;
    for (const key of GATED_KEYS) {
      expect(key in view, `gate leak: "${key}" on view ${view.id} (${view.status})`).toBe(false);
    }
    expect(Object.getOwnPropertySymbols(view)).toHaveLength(0);
    const json = JSON.stringify(view);
    expect(json).not.toContain(RATIONALE);
    for (const keyword of SECRET_KEYWORDS) {
      expect(json).not.toContain(keyword);
    }
  }
}

/** Whole-state serialization scan — valid only while NOTHING has been
 * revealed; this is where the machine's private symbol-keyed source store
 * must stay invisible (JSON.stringify skips symbol keys). */
function expectWholeStateGateHolds(state: QuizRunState) {
  expect(state.views.every((v) => !isRevealed(v.status))).toBe(true);
  expectGateHolds(state);
  const json = JSON.stringify(state);
  expect(json).not.toContain(RATIONALE);
  for (const keyword of SECRET_KEYWORDS) {
    expect(json).not.toContain(keyword);
  }
}

describe("attempt gate (NFR-8 — structural, via machine outputs)", () => {
  it("a fresh run exposes masked views only; q1 answering, the rest pending", () => {
    const state = startQuizRun({ mode: "mix", sessionId: "s-1", questions: mixQuestions() });
    expect(state.status).toBe("running");
    expect(state.currentIndex).toBe(0);
    expect(state.views.map((v) => v.status)).toEqual(["answering", "pending", "pending"]);
    expect(state.views.map((v) => v.id)).toEqual(["q1-choice", "q2-open", "q3-choice"]); // generator order — mix interleaves as given
    expectWholeStateGateHolds(state); // nothing revealed: the serialized state carries no answer prose anywhere
  });

  it("the gate holds through answering, hints, and the open grading wait", () => {
    let state = startQuizRun({ mode: "mix", sessionId: "s-1", questions: mixQuestions() });
    state = selectOption(state, 1);
    state = requestHint(state);
    expectGateHolds(state);

    // move to the open question, type, submit into the grading wait
    state = submitCurrent(state); // q1 choice → revealed
    expect(state.views[0]?.status).toBe("submitted"); // reveal happened HERE
    state = typeOpenAnswer(state, "my drafted answer");
    state = submitCurrent(state); // q2 open → grading wait
    expect(state.views[1]?.status).toBe("grading");
    expect(state.currentIndex).toBe(1);
    expectGateHolds(state); // NO outcome, rationale, or keywords while grading
  });

  it("answers become visible exactly at reveal — never before", () => {
    let state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    expectGateHolds(state);
    state = selectOption(state, 1);
    state = submitCurrent(state);
    const revealed = state.views[0];
    expect(revealed?.status).toBe("submitted");
    if (revealed?.status === "submitted") {
      expect(revealed.correctOptionIndex).toBe(1);
      expect(revealed.explanation).toBe(RATIONALE);
      expect(revealed.keywords).toEqual([]);
    }
    expect(JSON.stringify(state)).toContain(RATIONALE); // now it may show
  });
});

describe("choice path (client-side auto-grade, ADR-0001 values)", () => {
  it("no selection → submit refuses (same state back); invalid index refuses", () => {
    const state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    expect(submitCurrent(state)).toBe(state); // accidental taps never count (spec story 10)
    expect(selectOption(state, -1)).toBe(state);
    expect(selectOption(state, 3)).toBe(state);
    const selected = selectOption(state, 1);
    expect(selected).not.toBe(state);
    expect(selected.views[0]).toMatchObject({ status: "answering", selectedOptionIndex: 1 });
  });

  it("correct selection → outcome correct, outcomeValue 1 (ADR-0001)", () => {
    let state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    state = submitCurrent(selectOption(state, 1));
    const view = state.views[0];
    expect(view?.status).toBe("submitted");
    if (view?.status === "submitted") {
      expect(view.outcome).toBe("correct");
      expect(view.outcomeValue).toBe(MASTERY_CONFIG.outcomeValues.correct); // 1
      expect(view.outcomeValue).toBe(1);
      expect(view.userAnswer).toBe("the correct option");
      expect(view.forfeited).toBe(false);
    }
    expect(state.status).toBe("completed"); // single-question run completes
    expect(state.currentIndex).toBe(-1);
  });

  it("wrong selection → outcome wrong, outcomeValue 0, the real answer revealed", () => {
    let state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    state = submitCurrent(selectOption(state, 0));
    const view = state.views[0];
    if (view?.status === "submitted") {
      expect(view.outcome).toBe("wrong");
      expect(view.outcomeValue).toBe(MASTERY_CONFIG.outcomeValues.wrong); // 0
      expect(view.outcomeValue).toBe(0);
      expect(view.userAnswer).toBe("a wrong option");
      expect(view.correctOptionIndex).toBe(1); // review shows what was right
    } else {
      expect.unreachable("choice submit must reveal");
    }
  });

  it("forfeit instead of submit → revealed as wrong, outcome 0, answer visible AFTER forfeit", () => {
    let state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    expectGateHolds(state);
    state = forfeitCurrent(selectOption(state, 2));
    const view = state.views[0];
    expect(view?.status).toBe("forfeited");
    if (view?.status === "forfeited") {
      expect(view.outcome).toBe("wrong");
      expect(view.outcomeValue).toBe(0);
      expect(view.forfeited).toBe(true);
      expect(view.userAnswer).toBe("another wrong option"); // the abandoned attempt, honestly kept
      expect(view.correctOptionIndex).toBe(1);
      expect(view.explanation).toBe(RATIONALE);
    }
    expect(state.status).toBe("completed");
  });
});

describe("open path (AI-seam grading through the machine)", () => {
  it("submit freezes the draft into a masked grading wait; other transitions refuse", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    state = typeOpenAnswer(state, "我的答案草稿");
    expect(state.views[0]).toMatchObject({ status: "answering", draftAnswer: "我的答案草稿" });

    state = submitCurrent(state);
    expect(state.views[0]?.status).toBe("grading");
    expect(state.status).toBe("running"); // NOT completed — grading is in flight
    expectGateHolds(state);

    // grading wait is exclusive: no re-typing, no forfeit, no second submit
    expect(typeOpenAnswer(state, "改答案")).toBe(state);
    expect(forfeitCurrent(state)).toBe(state); // forfeit is pre-submit only
    expect(submitCurrent(state)).toBe(state);
    // grading lands ONLY on the grading wait — an answering state refuses
    const answering = typeOpenAnswer(startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] }), "作答");
    expect(applyOpenGrading(answering, graded("correct"))).toBe(answering);
  });

  it("the GradedAnswer outcome maps through ADR-0001 with rationale + citation carried", () => {
    for (const [outcome, value] of [
      ["correct", 1],
      ["partial", 0.5],
      ["wrong", 0],
    ] as const) {
      let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
      state = submitCurrent(typeOpenAnswer(state, "作答内容"));
      state = applyOpenGrading(state, graded(outcome));
      const view = state.views[0];
      expect(view?.status).toBe("graded");
      if (view?.status === "graded") {
        expect(view.outcome).toBe(outcome);
        expect(view.outcomeValue).toBe(value);
        expect(view.outcomeValue).toBe(MASTERY_CONFIG.outcomeValues[outcome]);
        expect(view.userAnswer).toBe("作答内容");
        expect(view.grading?.rationale).toBe(`graded against the material — ${outcome}`);
        expect(view.grading?.citation).toEqual({
          locator: { kind: "markdown", sectionId: "sec-1" },
          quote: "the source sentence",
        });
      } else {
        expect.unreachable("applied grading must reveal");
      }
      expect(state.status).toBe("completed");
    }
  });

  it("forfeit still works pre-submit, keeps the draft as the recorded attempt", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    state = forfeitCurrent(typeOpenAnswer(state, "半截思路"));
    const view = state.views[0];
    expect(view?.status).toBe("forfeited");
    if (view?.status === "forfeited") {
      expect(view.outcome).toBe("wrong");
      expect(view.outcomeValue).toBe(0);
      expect(view.forfeited).toBe(true);
      expect(view.userAnswer).toBe("半截思路");
      expect(view.grading).toBeNull(); // never graded — the reveal is the explanation
      expect(view.explanation).toBe(RATIONALE);
      expect(view.keywords).toEqual(SECRET_KEYWORDS); // visible only now
    }
  });

  it("hint is outcome-neutral and reveals nothing", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    state = requestHint(state);
    expect(state.views[0]).toMatchObject({ status: "answering", hintUsed: true, draftAnswer: "" });
    expectGateHolds(state);
    state = submitCurrent(typeOpenAnswer(state, "作答"));
    state = applyOpenGrading(state, graded("partial"));
    const view = state.views[0];
    if (view?.status === "graded") {
      expect(view.hintUsed).toBe(true); // flag carried onto the result
      expect(view.outcome).toBe("partial"); // the hint never moved it
    }
  });
});

describe("mix run — one machine run over interleaved kinds", () => {
  it("walks choice → open-grading → forfeit to completion with ordered results", () => {
    let state = startQuizRun({ mode: "mix", sessionId: "s-1", questions: mixQuestions() });

    // q1 choice, wrong
    state = submitCurrent(selectOption(state, 0));
    expect(state.currentIndex).toBe(1); // auto-advance, one question at a time
    expect(state.status).toBe("running");

    // q2 open, partial through the grading wait
    state = submitCurrent(typeOpenAnswer(state, "只命中一个要点"));
    expect(state.views[1]?.status).toBe("grading");
    state = applyOpenGrading(state, graded("partial"));
    expect(state.currentIndex).toBe(2);

    // results refused until completion
    expect(quizResults(state)).toBeNull();

    // q3 choice, forfeited
    state = forfeitCurrent(state);
    expect(state.status).toBe("completed");
    expect(state.currentIndex).toBe(-1);

    const results = quizResults(state);
    expect(results).not.toBeNull();
    expect(results?.map((r) => r.questionId)).toEqual(["q1-choice", "q2-open", "q3-choice"]);
    expect(results?.map((r) => r.nodeId)).toEqual(["node-a", "node-b", "node-b"]); // AD-6 attribution, untouched
    expect(results?.map((r) => r.outcome)).toEqual(["wrong", "partial", "wrong"]);
    expect(results?.map((r) => r.outcomeValue)).toEqual([0, 0.5, 0]); // ADR-0001, exact
    expect(results?.map((r) => r.forfeited)).toEqual([false, false, true]);
    expect(results?.[1]?.grading?.citation?.locator).toEqual({ kind: "markdown", sectionId: "sec-1" });
    expect(results?.[0]?.grading).toBeNull();
    expect(results?.[2]?.grading).toBeNull();
    expect(results?.[2]?.correctOptionIndex).toBe(2);
  });

  it("a completed run cannot be re-completed or re-answered (terminal)", () => {
    let state = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [choiceQ()] });
    state = submitCurrent(selectOption(state, 1));
    expect(state.status).toBe("completed");
    expect(selectOption(state, 0)).toBe(state);
    expect(submitCurrent(state)).toBe(state);
    expect(forfeitCurrent(state)).toBe(state);
    expect(abandonRun(state)).toBe(state);
  });
});

describe("abandon — terminal, not resumable, produces nothing", () => {
  it("abandon mid-run freezes the state; every transition refuses; results stay null", () => {
    let state = startQuizRun({ mode: "mix", sessionId: "s-1", questions: mixQuestions() });
    state = submitCurrent(selectOption(state, 1)); // q1 done
    state = abandonRun(state);
    expect(state.status).toBe("abandoned");
    expect(state.currentIndex).toBe(-1);
    expect(quizResults(state)).toBeNull();

    expect(selectOption(state, 0)).toBe(state);
    expect(typeOpenAnswer(state, "text")).toBe(state);
    expect(requestHint(state)).toBe(state);
    expect(submitCurrent(state)).toBe(state);
    expect(forfeitCurrent(state)).toBe(state);
    expect(abandonRun(state)).toBe(state); // idempotent terminal
    // already-revealed views stay revealed; the pending one stays masked
    expect(state.views.map((v) => v.status)).toEqual(["submitted", "answering", "pending"]);
  });
});

describe("hydrate (T2 resumption) — active only", () => {
  const session = (status: QuizSession["status"], questionIds: string[]): QuizSession => ({
    id: "s-1",
    planId: null,
    taskId: null,
    mode: "mix",
    questionIds,
    status,
    createdAt: "2026-11-03T00:00:00Z",
    completedAt: null,
  });

  it("an ACTIVE session revives at question 1 with every answer still behind the gate", () => {
    const questions = mixQuestions();
    const state = hydrateQuizRun(
      session("active", questions.map((q) => q.id)),
      questions,
    );
    expect(state.status).toBe("running");
    expect(state.sessionId).toBe("s-1");
    expect(state.mode).toBe("mix");
    expect(state.currentIndex).toBe(0);
    expect(state.views.map((v) => v.status)).toEqual(["answering", "pending", "pending"]);
    expectGateHolds(state);
  });

  it("a hydrated run plays through to completion and real results (resumption works)", () => {
    const questions = mixQuestions();
    let state = hydrateQuizRun(session("active", questions.map((q) => q.id)), questions);
    state = submitCurrent(selectOption(state, 1));
    state = applyOpenGrading(submitCurrent(typeOpenAnswer(state, "答")), graded("correct"));
    state = submitCurrent(selectOption(state, 2));
    expect(state.status).toBe("completed");
    expect(quizResults(state)?.map((r) => r.outcomeValue)).toEqual([1, 1, 1]);
  });

  it("refuses abandoned and completed sessions — terminal is NOT resumable", () => {
    const questions = mixQuestions();
    const ids = questions.map((q) => q.id);
    for (const status of ["abandoned", "completed"] as const) {
      expect(() => hydrateQuizRun(session(status, ids), questions)).toThrowError(AppError);
      try {
        hydrateQuizRun(session(status, ids), questions);
        expect.unreachable(`${status} sessions must not hydrate`);
      } catch (e) {
        expect((e as AppError).code).toBe("QUIZ_RUN_NOT_RESUMABLE");
      }
    }
  });

  it("refuses questions that do not match the session's questionIds (order included)", () => {
    const questions = mixQuestions();
    expect(() => hydrateQuizRun(session("active", ["a", "b", "c"]), questions)).toThrowError(AppError);
    try {
      hydrateQuizRun(session("active", questions.map((q) => q.id).reverse()), questions);
      expect.unreachable("order mismatch must refuse");
    } catch (e) {
      expect((e as AppError).code).toBe("QUIZ_RUN_QUESTIONS_MISMATCH");
    }
  });

  it("startQuizRun refuses an empty question set (nothing to run)", () => {
    try {
      startQuizRun({ mode: "choice", sessionId: "s-1", questions: [] });
      expect.unreachable("empty run must throw");
    } catch (e) {
      expect((e as AppError).code).toBe("QUIZ_RUN_EMPTY");
    }
  });
});

describe("releaseGrading — the grading-failure escape (review P2-2)", () => {
  it("releases the open question back to answering, draft intact, resubmittable to completion", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    state = typeOpenAnswer(state, "my kept draft");
    state = submitCurrent(state);
    expect(state.views[0]?.status).toBe("grading");
    state = releaseGrading(state);
    expect(state.views[0]?.status).toBe("answering");
    const active = state.views[0];
    expect(active && "draftAnswer" in active ? active.draftAnswer : null).toBe("my kept draft");
    // the run still completes: resubmit → grading → seam result lands
    state = submitCurrent(state);
    expect(state.views[0]?.status).toBe("grading");
    state = applyOpenGrading(state, graded("correct"));
    expect(state.status).toBe("completed");
  });

  it("is a no-op outside the grading wait (answering / terminal)", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    expect(releaseGrading(state)).toBe(state); // answering — nothing to release
    state = applyOpenGrading(submitCurrent(state), graded("correct"));
    expect(releaseGrading(state)).toBe(state); // completed terminal
  });

  it("the attempt gate still holds after a release — nothing was revealed", () => {
    let state = startQuizRun({ mode: "open", sessionId: "s-1", questions: [openQ()] });
    state = typeOpenAnswer(state, "draft");
    state = releaseGrading(submitCurrent(state));
    expectWholeStateGateHolds(state);
  });
});

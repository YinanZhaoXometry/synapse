import { beforeEach, describe, expect, it } from "vitest";
import { computeNodeScore, computePlanRollup } from "@/domain/mastery";
import { loadDb } from "./store";
import {
  createQuizSession,
  getQuizSession,
  recordEvidence,
  type AnswerResult,
  type QuestionInput,
} from "./quiz-repository";

beforeEach(() => {
  localStorage.clear();
});

const questions: QuestionInput[] = [
  {
    prompt: "What does integration testing focus on?",
    nodeId: "node-a",
    kind: "choice",
    options: ["components' interactions", "single functions"],
    correctOptionIndex: 0,
    sourceMaterialId: "m-1",
    sourceSectionId: "page-7",
    explanation: "Integration testing = interactions between components.",
  },
  {
    prompt: "为什么接口契约要先验证？",
    nodeId: "node-a",
    kind: "open",
    sourceMaterialId: "m-1",
    sourceSectionId: "page-7",
    keywords: ["契约", "验证"],
    explanation: "Contracts gate system testing.",
  },
  {
    prompt: "Which is a design principle?",
    nodeId: "node-b",
    kind: "choice",
    options: ["SRP", "Random typing"],
    correctOptionIndex: 0,
    sourceMaterialId: "m-1",
    sourceSectionId: "page-8",
    explanation: "SRP.",
  },
];

function answer(questionId: string, outcome: AnswerResult["outcome"], overrides: Partial<AnswerResult> = {}): AnswerResult {
  return { questionId, outcome, userAnswer: "answer text", forfeited: false, ...overrides };
}

describe("evidence loop (seam: repository API; the spine's core data flow)", () => {
  it("session + questions round-trip; recordEvidence appends node-attributed evidence", () => {
    const { session, questions: stored } = createQuizSession({
      planId: "p-1",
      taskId: null,
      mode: "mix",
      questions,
    });

    const loaded = getQuizSession(session.id);
    expect(loaded?.status).toBe("active");
    expect(loaded?.questionIds).toHaveLength(3);
    expect(stored.every((q) => q.sessionId === session.id)).toBe(true);
    expect(stored.map((q) => q.nodeId)).toEqual(["node-a", "node-a", "node-b"]);

    const evidence = recordEvidence({
      sessionId: session.id,
      results: [
        answer(stored[0].id, "correct"),
        answer(stored[1].id, "partial"),
        answer(stored[2].id, "wrong"),
      ],
    });
    expect(evidence).toHaveLength(3);
    expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
    expect(evidence.map((e) => e.outcome)).toEqual(["correct", "partial", "wrong"]);
    expect(loadDb().evidence).toHaveLength(3); // persisted
  });

  it("stored evidence drives mastery exactly per ADR-0001 (window, gate, rollup)", () => {
    const { session, questions: stored } = createQuizSession({
      planId: "p-2",
      taskId: null,
      mode: "choice",
      questions,
    });
    recordEvidence({
      sessionId: session.id,
      results: [
        answer(stored[0].id, "correct"),
        answer(stored[1].id, "correct"),
        answer(stored[2].id, "correct"),
      ],
    });

    const db = loadDb();
    const byNode: Record<string, typeof db.evidence> = {};
    for (const e of db.evidence) (byNode[e.nodeId] ??= []).push(e);

    // node-a: 2 records (gate unmet) → capped 99; node-b: 1 record → capped 99.
    // Rollup = 99: below 100 while any node is un-gated — the readiness contract holds.
    expect(computeNodeScore(byNode["node-a"])).toBe(99);
    expect(computePlanRollup({ "node-a": byNode["node-a"], "node-b": byNode["node-b"] })).toBe(99);
  });

  it("recordEvidence is atomic: one bogus question id aborts the whole batch", () => {
    const { session, questions: stored } = createQuizSession({
      planId: null,
      taskId: "t-1",
      mode: "choice",
      questions: [questions[0]],
    });
    expect(() =>
      recordEvidence({
        sessionId: session.id,
        results: [answer(stored[0].id, "correct"), answer("no-such-question", "correct")],
      }),
    ).toThrow(/no-such-question/);
    expect(loadDb().evidence).toHaveLength(0); // nothing partially written
  });

  it("a forfeited answer records wrong evidence and lands in the MistakeEntry log", () => {
    const { session, questions: stored } = createQuizSession({
      planId: null,
      taskId: null,
      mode: "open",
      questions: [questions[1]], // open, source page-7, material m-1 (pdf)
    });
    recordEvidence({
      sessionId: session.id,
      results: [answer(stored[0].id, "wrong", { forfeited: true, userAnswer: "" })],
    });

    const db = loadDb();
    expect(db.evidence[0].outcome).toBe("wrong");

    const mistake = db.mistakes[0];
    expect(mistake.questionId).toBe(stored[0].id);
    expect(mistake.nodeId).toBe("node-a");
    expect(mistake.forfeited).toBe(true);
    expect(mistake.sourceLocation).toEqual({ kind: "pdf", page: 7 }); // locator resolved from the question's source
  });

  it("wrong answers (choice or graded open) each create a MistakeEntry", () => {
    const { session, questions: stored } = createQuizSession({
      planId: null,
      taskId: null,
      mode: "mix",
      questions,
    });
    recordEvidence({
      sessionId: session.id,
      results: [
        answer(stored[0].id, "wrong", { userAnswer: "single functions" }),
        answer(stored[2].id, "partial"), // not wrong — no mistake
        answer(stored[1].id, "wrong", { userAnswer: "不知道" }),
      ],
    });
    expect(loadDb().mistakes).toHaveLength(2);
    expect(loadDb().mistakes.map((m) => m.userAnswer)).toEqual(["single functions", "不知道"]);
  });
});

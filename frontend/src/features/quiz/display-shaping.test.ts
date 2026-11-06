import { describe, expect, it } from "vitest";
import type { EvidenceRecord, Material, Outcome } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import type { KnowledgeNodeView } from "@/api/views";
import type { GradedAnswer } from "@/ai/types";
import type { QuizAnswerResult } from "./session-machine";
import {
  quizableMaterials,
  quizBreakdownRows,
  quizHintFor,
  quizMaterialRefs,
  quizMistakeViews,
  quizNodeRows,
  quizScoreSummary,
} from "./display-shaping";

/**
 * Quiz display-shaping selectors (T2; spec testing decisions — exact ADR-0001
 * numbers: window 5, cap-99 below the 3-evidence gate, mastered = ≥ 80 & ≥ 3;
 * no duplicated display arithmetic — the expectations here are independent
 * literals, never recomputed through the selectors under test).
 */

const node = (id: string, overrides: Partial<KnowledgeNodeView> = {}): KnowledgeNodeView => ({
  id,
  planId: "p1",
  taskId: null,
  stage: null,
  title: `node-${id}`,
  description: null,
  optional: false,
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  ...overrides,
});

let evidenceSeq = 0;
const evidence = (nodeId: string, outcome: Outcome, sessionId: string | null, createdAt: string): EvidenceRecord => ({
  id: `e-${evidenceSeq++}`,
  nodeId,
  sessionId,
  questionId: null,
  outcome,
  createdAt,
});

const material: Material = {
  id: "m1",
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 64,
  planId: "p1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [
    { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
    { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
  ],
  createdAt: "2026-11-03T09:00:00Z",
};

const result = (overrides: Partial<QuizAnswerResult>): QuizAnswerResult => ({
  questionId: "q1",
  nodeId: "n1",
  kind: "choice",
  prompt: "prompt",
  outcome: "correct",
  outcomeValue: 1,
  userAnswer: "集成测试",
  forfeited: false,
  hintUsed: false,
  sourceMaterialId: "m1",
  sourceSectionId: "sec-1",
  correctOptionIndex: 0,
  options: ["集成测试", "需求工程", "回归测试"],
  explanation: "集成测试 — 集成测试关注组件之间的交互。",
  grading: null,
  ...overrides,
});

const grading: GradedAnswer = {
  outcome: "partial",
  rationale: "对照材料评分 · 只命中「集成」——还差其他要点。",
  citation: { locator: { kind: "markdown", sectionId: "sec-1" }, quote: "集成测试关注组件之间的交互。" },
};

describe("quizScoreSummary (T2 results header)", () => {
  it("counts outcomes and shapes the round percent from the machine's ADR-0001 values (1 / 0.5 / 0)", () => {
    const summary = quizScoreSummary([
      result({}),
      result({ outcome: "partial", outcomeValue: 0.5 }),
      result({ outcome: "wrong", outcomeValue: 0 }),
    ]);
    expect(summary).toEqual({ correct: 1, partial: 1, wrong: 1, total: 3, percent: 50 });
  });

  it("a perfect round reads 100; an empty one reads 0 honestly", () => {
    expect(quizScoreSummary([result({}), result({})]).percent).toBe(100);
    expect(quizScoreSummary([]).percent).toBe(0);
  });
});

describe("quizNodeRows (T2 mastery rows — SERVER fields since the cutover, AD-14)", () => {
  it("the score/state ride the server view verbatim; the marks keep the last-5 window (oldest → newest)", () => {
    const records = [
      evidence("n1", "wrong", "s0", "2026-11-01T10:00:00Z"), // oldest — outside the marks window
      ...["2026-11-01T11:00:00Z", "2026-11-01T12:00:00Z", "2026-11-01T13:00:00Z", "2026-11-01T14:00:00Z", "2026-11-01T15:00:00Z"].map(
        (at) => evidence("n1", "correct", "s1", at),
      ),
    ];
    const [row] = quizNodeRows([result({})], [node("n1", { masteryScore: "100", state: "mastered" })], records);
    expect(row.score).toBe(100); // the api's number, passed through — never recomputed
    expect(row.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "correct"]);
    expect(row.state).toBe("mastered");
    expect(row.belowGate).toBe(false);
  });

  it("cap-99 below the gate: a partial node at the api's 99 cap carries the belowGate flag", () => {
    const records = [evidence("n1", "correct", "s1", "2026-11-01T10:00:00Z")];
    const [row] = quizNodeRows([result({})], [node("n1", { masteryScore: "99", state: "partial" })], records);
    expect(row.score).toBe(99);
    expect(row.belowGate).toBe(true);
    expect(row.state).toBe("partial");
  });

  it("a mastered node shows no cap note", () => {
    const records = [
      evidence("n1", "correct", "s1", "2026-11-01T10:00:00Z"),
      evidence("n1", "correct", "s1", "2026-11-01T11:00:00Z"),
      evidence("n1", "correct", "s1", "2026-11-01T12:00:00Z"),
    ];
    const [row] = quizNodeRows([result({})], [node("n1", { masteryScore: "100", state: "mastered" })], records);
    expect(row.score).toBe(100);
    expect(row.state).toBe("mastered");
    expect(row.belowGate).toBe(false);
  });

  it("no before/after delta — the api exposes no pre-session score surface (contract gap surfaced; AD-14 forbids recompute)", () => {
    const records = [
      evidence("n1", "correct", "s0", "2026-11-01T10:00:00Z"),
      evidence("n1", "wrong", "s1", "2026-11-02T10:00:00Z"),
    ];
    const [row] = quizNodeRows([result({})], [node("n1", { masteryScore: "75", state: "partial" })], records);
    expect(row).not.toHaveProperty("before");
    expect(row).not.toHaveProperty("after");
    expect(row.score).toBe(75);
    expect(row.lastOutcomes).toEqual(["correct", "wrong"]);
  });

  it("one row per affected node, first-appearance order; unknown nodes fall back to the id as title", () => {
    const rows = quizNodeRows(
      [result({ nodeId: "n2" }), result({ nodeId: "n1", questionId: "q2" }), result({ nodeId: "n2", questionId: "q3" })],
      [node("n1", { title: "软件测试" })],
      [],
    );
    expect(rows.map((r) => r.nodeId)).toEqual(["n2", "n1"]);
    expect(rows[0].title).toBe("n2");
    expect(rows[1].title).toBe("软件测试");
    expect(rows.every((r) => r.score === 0 && !r.hasEvidence)).toBe(true);
  });
});

describe("quizBreakdownRows + quizMistakeViews (T2 breakdown & mistakes)", () => {
  it("resolves the section title and carries the grader's citation quote (open); choice has no quote", () => {
    const rows = quizBreakdownRows(
      [result({ kind: "open", grading }), result({ questionId: "q2", sourceSectionId: "sec-2" })],
      [material],
    );
    expect(rows[0].sectionTitle).toBe("集成测试");
    expect(rows[0].quote).toBe("集成测试关注组件之间的交互。");
    expect(rows[1].sectionTitle).toBe("需求工程");
    expect(rows[1].quote).toBeNull();
  });

  it("an unresolvable section degrades to null — never a fabricated title", () => {
    const [row] = quizBreakdownRows([result({ sourceSectionId: "gone" })], [material]);
    expect(row.sectionTitle).toBeNull();
  });

  it("wrong answers shape the compare card: correct option TEXT for choice, reference for open, forfeit flagged", () => {
    const views = quizMistakeViews(
      [
        result({ outcome: "wrong", outcomeValue: 0, userAnswer: "需求工程", correctOptionIndex: 2 }),
        result({ questionId: "q2", kind: "open", outcome: "wrong", outcomeValue: 0, userAnswer: "不知道", forfeited: true, grading }),
      ],
      [material],
    );
    expect(views).toHaveLength(2);
    expect(views[0].correctAnswer).toBe("回归测试");
    expect(views[0].userAnswer).toBe("需求工程");
    expect(views[0].note).toBe(result({}).explanation); // no grading → the explanation
    expect(views[0].forfeited).toBe(false);
    expect(views[1].forfeited).toBe(true);
    expect(views[1].note).toBe(grading.rationale); // grading rationale wins when carried
  });

  it("correct/partial answers never appear as mistakes", () => {
    expect(quizMistakeViews([result({}), result({ outcome: "partial", outcomeValue: 0.5 })], [material])).toHaveLength(0);
  });
});

describe("quizHintFor + material shaping (T2 runner/launcher helpers)", () => {
  it("the hint is the source section's TITLE — never the explanation text", () => {
    expect(quizHintFor({ sourceMaterialId: "m1", sourceSectionId: "sec-1" }, [material])).toBe("集成测试");
    expect(quizHintFor({ sourceMaterialId: "m1", sourceSectionId: "gone" }, [material])).toBeNull();
    expect(quizHintFor({ sourceMaterialId: "gone", sourceSectionId: "sec-1" }, [material])).toBeNull();
  });

  it("quizable materials: parsed with ≥1 section only — pending/failed/empty never offer a quiz", () => {
    const pending: Material = { ...material, id: "m2", parseState: "pending" };
    const failed: Material = { ...material, id: "m3", parseState: "failed" };
    const empty: Material = { ...material, id: "m4", sections: [] };
    const quizable = quizableMaterials([pending, failed, empty, material]);
    expect(quizable.map((m) => m.id)).toEqual(["m1"]);
    const refs = quizMaterialRefs(quizable);
    expect(refs).toEqual([{ materialId: "m1", sections: material.sections }]);
  });

  it("the gate constant feeding the cap note is the domain's own (3)", () => {
    expect(MASTERY_CONFIG.evidenceGate).toBe(3);
  });
});

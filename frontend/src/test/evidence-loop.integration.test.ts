/**
 * Epic-1 integration slice (T7): the spine's evidence-loop diagram walked
 * across all three seams — domain, data, ai — in one pass, ending in a reload
 * simulation. Expected values are worked examples from ADR-0001.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { computeNodeScore, computePlanRollup, getNodeState } from "@/domain/mastery";
import { computeStreak } from "@/domain/streak";
import { listEvidence } from "@/data/quiz-repository";
import { createPlan } from "@/data/plan-repository";
import { registerMaterial } from "@/data/material-repository";
import { createSessionBlobRegistry } from "@/data/session-blobs";
import { loadDb } from "@/data/store";
import { appendChatMessage, getChatThread, getReadingProgress, saveReadingProgress } from "@/data/progress-repository";
import { createQuizSession, recordEvidence, type AnswerResult } from "@/data/quiz-repository";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialSection, ReadingPosition } from "@/domain/entities";

const sections: MaterialSection[] = [
  { id: "page-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "page-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
  { id: "page-3", title: "Design principles", text: "SOLID keeps modules cohesive and decoupled." },
  { id: "page-4", title: "测试层级", text: "单元测试之后是集成测试，再是系统测试。" },
];

const svc = getCompanionService();

beforeEach(() => {
  localStorage.clear();
});

describe("the evidence loop, end to end (plan → material → quiz → evidence → mastery)", () => {
  it("walks the spine's core data flow and lands on ADR-0001's exact numbers", async () => {
    // 1. plan with two nodes
    const { plan } = createPlan({
      topic: "COMP5241 软件工程",
      goal: "exam prep",
      nodes: [
        { title: "测试层级", stage: "测试与交付" },
        { title: "需求工程", stage: "需求" },
      ],
    });
    const nodes = loadDb().nodes.filter((n) => n.planId === plan.id);
    const [nodeA, nodeB] = nodes;

    // 2. material attach (blob session-only)
    const blobs = createSessionBlobRegistry();
    const { material } = registerMaterial({
      title: "lecture-4.pdf",
      kind: "pdf",
      sizeBytes: 900,
      planId: plan.id,
      taskId: null,
      blob: new Blob(["pdf-bytes"]),
      blobRegistry: blobs,
      sections,
    });

    // 3. CompanionService generates a node-attributed Mix quiz from the material
    const questions = await svc.generateQuiz({
      materials: [{ materialId: material.id, sections }],
      nodeIds: [nodeA.id, nodeB.id],
      mode: "mix",
    });
    expect(questions).toHaveLength(8); // 4 sections × (choice + open), under the cap
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([nodeA.id, nodeB.id]));

    // 4. session + answers: A all-correct ×4; B correct + partial + forfeit
    const { session, questions: stored } = createQuizSession({
      planId: plan.id,
      taskId: null,
      mode: "mix",
      questions,
    });
    const byNode = (id: string) => stored.filter((q) => q.nodeId === id);
    const results: AnswerResult[] = [
      ...byNode(nodeA.id).map((q) => ({ questionId: q.id, outcome: "correct" as const, userAnswer: "picked", forfeited: false })),
      ...byNode(nodeB.id).map((q, i) =>
        i === 2
          ? { questionId: q.id, outcome: "wrong" as const, userAnswer: "", forfeited: true }
          : i === 1
            ? { questionId: q.id, outcome: "partial" as const, userAnswer: "half right", forfeited: false }
            : { questionId: q.id, outcome: "correct" as const, userAnswer: "answered", forfeited: false },
      ),
    ];
    const evidence = recordEvidence({ sessionId: session.id, results });

    // 5. mastery per ADR-0001 — worked example (8 questions round-robin → A:4, B:4):
    //    A: 4 corrects → 100, gate met → mastered
    //    B: correct+partial+forfeit+correct → (1+0.5+0+1)/4 = 63, gate met → partial
    //    rollup = floor((100+63)/2) = 81 ; streak = today = 1
    //    (floor per ADR-0001 amendment 2026-11-04; half-up used to read 82)
    const evA = evidence.filter((e) => e.nodeId === nodeA.id);
    const evB = evidence.filter((e) => e.nodeId === nodeB.id);
    expect(evA).toHaveLength(4);
    expect(evB).toHaveLength(4);
    expect(computeNodeScore(evA)).toBe(100);
    expect(getNodeState(evA)).toBe("mastered");
    expect(computeNodeScore(evB)).toBe(63);
    expect(getNodeState(evB)).toBe("partial");
    expect(computePlanRollup({ [nodeA.id]: evA, [nodeB.id]: evB })).toBe(81);
    expect(computeStreak(evidence, new Date())).toBe(1);

    // 6. mistakes from the same pass: the forfeit logged with its source
    const db = loadDb();
    expect(db.evidence).toHaveLength(8);
    expect(db.mistakes).toHaveLength(1);
    expect(db.mistakes[0].forfeited).toBe(true);
    expect(db.mistakes[0].sourceLocation).toEqual({ kind: "pdf", page: expect.any(Number) });

    // reader state persisted alongside
    const position: ReadingPosition = { locator: { kind: "pdf", page: 3 }, text: sections[2].text };
    saveReadingProgress(material.id, position);
    appendChatMessage(material.id, { role: "user", text: "这一页讲什么？", citations: [] });

    // 7. reload simulation: fresh blob registry, same localStorage
    expect(listEvidence()).toHaveLength(8);
    expect(getChatThread(material.id)?.messages).toHaveLength(1);
    expect(getReadingProgress(material.id)?.position.locator).toEqual({ kind: "pdf", page: 3 });
    expect(createSessionBlobRegistry().has(material.id)).toBe(false); // blob gone — re-upload
  });
});

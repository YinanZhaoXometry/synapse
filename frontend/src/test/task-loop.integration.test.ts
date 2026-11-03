/**
 * Epic-5 integration walk (T4): the Study Task loop (FR-37) walked across the
 * same seams as the evidence/reader loops — create task → attach bytes →
 * eager parse → reading-position save → repository-level quiz generation,
 * session creation, and evidence recording against the task's node → exact
 * ADR-0001 numbers on the task rollup → reload simulation from the same
 * localStorage key. No quiz UI: every step is the real production seam the
 * task flow calls (TaskCreatePage's register→createTask→parse sequence, the
 * simulated Companion's generation, the quiz repository's write path).
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
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  createPlan,
  createQuizSession,
  createStudyTask,
  getMaterial,
  getQuizSession,
  getReadingProgress,
  getTask,
  getTaskNode,
  listEvidence,
  listEvidenceByNode,
  loadDb,
  recordEvidence,
  registerMaterial,
  saveReadingProgress,
  sessionBlobs,
  type AnswerResult,
} from "@/data";
import { computeNodeScore, computePlanRollup, computeTaskRollup, getNodeState } from "@/domain/mastery";
import { getCompanionService } from "@/ai/companion-service";
import { parseFromSessionBlob } from "@/features/reader/parse-material";
import { positionText } from "@/features/reader/position-tracking";
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
 * through — hand the registry Node's Blob (the reader-loop bridge). */
const mdBlob = () => new NodeBlob([new TextEncoder().encode(markdownDoc)]) as unknown as Blob;

beforeEach(() => {
  localStorage.clear();
});

describe("the task loop, end to end (create → attach → parse → read → quiz → evidence → reload)", () => {
  it("walks FR-37 across the seams and lands on ADR-0001's exact task-rollup numbers", async () => {
    // 1. attach + create — exactly TaskCreatePage's sequence: register the
    //    material parse-pending with session-only bytes (taskId null — the
    //    material cannot know the task yet), then createStudyTask back-links
    //    the material and auto-creates its exactly-one node (AD-6).
    const { material } = registerMaterial({
      title: "复习讲义.md",
      kind: "markdown",
      sizeBytes: markdownDoc.length,
      planId: null,
      taskId: null,
      blob: mdBlob(),
      sections: [],
      parseState: "pending",
    });
    expect(sessionBlobs.has(material.id)).toBe(true);

    const { task, node } = createStudyTask({ materialId: material.id });
    expect(task.materialId).toBe(material.id);
    expect(task.nodeId).toBe(node.id);
    // exactly ONE auto-created node, owned by the task, belonging to no plan
    const ownedNodes = loadDb().nodes.filter((n) => n.taskId === task.id);
    expect(ownedNodes).toHaveLength(1);
    expect(node.planId).toBeNull();
    expect(node.taskId).toBe(task.id);
    expect(node.title).toBe(material.title); // titled from the material (AD-6)
    // material back-linked (the task home's 1:1 row resolves through this)
    expect(getMaterial(material.id).taskId).toBe(task.id);

    // 2. the AD-6 isolation control: a plan + node sibling, sharing NOTHING
    //    with the task — its evidence set stays empty forever, below.
    const { plan } = createPlan({
      topic: "COMP5241 软件工程",
      goal: "exam prep",
      nodes: [{ title: " sibling 节点", stage: "需求" }],
    });
    const planNode = loadDb().nodes.find((n) => n.planId === plan.id)!;
    expect(planNode.taskId).toBeNull();

    // 3. eager parse (AD-7): the reader's public path, run exactly as the
    //    creation flow's parseMaterial.mutate runs it — session bytes in,
    //    honest outcome written back through the repository.
    const outcome = await parseFromSessionBlob(material.id);
    expect(outcome).not.toBeNull();
    expect(outcome.state).toBe("parsed");
    const parsed = getMaterial(material.id);
    expect(parsed.parseState).toBe("parsed");
    expect(parsed.sections).toHaveLength(3); // one per heading

    // 4. read (FR-10): the tracker's bounded text resolver persists what is
    //    visible — an extract of the section, never raw file bytes (AD-4).
    const locator: ReadingLocator = { kind: "markdown", sectionId: parsed.sections[0].id };
    const position: ReadingPosition = { locator, text: positionText(parsed, locator) };
    expect(position.text).toBe(parsed.sections[0].text);
    saveReadingProgress(material.id, position);
    expect(getReadingProgress(material.id)?.position).toEqual(position);

    // 5. quiz generation against the task's node: sections + [taskNodeId] —
    //    every question attributed to the single owned node (AD-6) and
    //    sourced from the material's own sections (FR-18/NFR-1).
    const svc = getCompanionService();
    const questions = await svc.generateQuiz({
      materials: [{ materialId: material.id, sections: parsed.sections }],
      nodeIds: [node.id],
      mode: "mix",
    });
    expect(questions).toHaveLength(6); // 3 sections × (choice + open), under the cap
    expect(new Set(questions.map((q) => q.nodeId))).toEqual(new Set([node.id]));
    const sectionIds = new Set(parsed.sections.map((s) => s.id));
    for (const q of questions) {
      expect(q.sourceMaterialId).toBe(material.id);
      expect(sectionIds.has(q.sourceSectionId)).toBe(true);
    }

    // 6. round one — 2 answers, both correct. ADR-0001 cap-99 below the
    //    gate: the raw mean is 100, but 2 records < gate 3, so the node
    //    displays at most 99 — score 100 must mean VERIFIED mastery, and a
    //    perfect-but-unverified node reads 99% ("one more verified round").
    const first = createQuizSession({ planId: null, taskId: task.id, mode: "mix", questions });
    expect(first.session.planId).toBeNull();
    expect(first.session.taskId).toBe(task.id);
    const roundOne: AnswerResult[] = first.questions.slice(0, 2).map((q) => ({
      questionId: q.id,
      outcome: "correct" as const,
      userAnswer: "answered",
      forfeited: false,
    }));
    recordEvidence({ sessionId: first.session.id, results: roundOne });
    // recordEvidence closes the session (the persisted copy — re-read it)
    expect(getQuizSession(first.session.id)?.status).toBe("completed");

    const afterRoundOne = listEvidenceByNode(node.id);
    expect(afterRoundOne).toHaveLength(2);
    expect(computeNodeScore(afterRoundOne)).toBe(99); // capped — raw would be 100
    expect(computeTaskRollup(afterRoundOne)).toBe(99); // task rollup = its single node's score (ADR-0001)
    expect(getNodeState(afterRoundOne)).toBe("partial"); // ≥80 but the gate is unmet

    // 7. round two — the "one more verified round": a fresh session against
    //    the same node; first answer forfeited, then three correct. Six
    //    records total now; the window is the LAST 5, so the oldest round-one
    //    correct falls out: values (newest first) 1,1,1,0,1 → 80 — the plain
    //    mean over all six would be 83, so this number pins the window. The
    //    gate is met (6 ≥ 3) and 80 is exactly the mastered threshold
    //    (score ≥ 80 AND ≥ 3 → mastered).
    const second = createQuizSession({
      planId: null,
      taskId: task.id,
      mode: "mix",
      questions: await svc.generateQuiz({
        materials: [{ materialId: material.id, sections: parsed.sections }],
        nodeIds: [node.id],
        mode: "mix",
      }),
    });
    const roundTwo: AnswerResult[] = second.questions.slice(0, 4).map((q, i) =>
      i === 0
        ? { questionId: q.id, outcome: "wrong" as const, userAnswer: "", forfeited: true }
        : { questionId: q.id, outcome: "correct" as const, userAnswer: "answered", forfeited: false },
    );
    recordEvidence({ sessionId: second.session.id, results: roundTwo });

    const evidence = listEvidenceByNode(node.id);
    expect(evidence).toHaveLength(6);
    expect(computeTaskRollup(evidence)).toBe(80); // window-5 mean, exactly the mastered threshold
    expect(getNodeState(evidence)).toBe("mastered"); // ≥80 AND ≥3 (ADR-0001)
    expect(getTaskNode(task.id)?.id).toBe(node.id); // the task's mastery IS this node's

    // 8. AD-6 isolation: every evidence record belongs to the task's node —
    //    the sibling plan's node has none, so its rollup stays 0 (uncovered
    //    nodes count 0) and the task's evidence cannot move any plan score.
    const planEvidence = listEvidenceByNode(planNode.id);
    expect(planEvidence).toHaveLength(0);
    expect(computePlanRollup({ [planNode.id]: planEvidence })).toBe(0);
    expect(new Set(listEvidence().map((e) => e.nodeId))).toEqual(new Set([node.id]));

    // 9. mistakes from the same pass (FR-18): the forfeit is logged with its
    //    markdown source section — wrong/forfeit = logged, no credit.
    const db = loadDb();
    expect(db.mistakes).toHaveLength(1);
    expect(db.mistakes[0].forfeited).toBe(true);
    expect(db.mistakes[0].nodeId).toBe(node.id);
    expect(db.mistakes[0].sourceLocation).toEqual({
      kind: "markdown",
      sectionId: second.questions[0].sourceSectionId,
    });

    // 10. reload simulation (the honest kind): same localStorage, fresh
    //     in-memory world — vi.resetModules re-creates every module and the
    //     walk imports fresh ones against the SAME storage key. Task, node,
    //     material metadata, reading progress, and evidence all survive;
    //     the session-only bytes do not (re-upload contract, FR-29).
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    vi.resetModules();
    const fresh = await import("@/data");
    const freshMastery = await import("@/domain/mastery");

    const reloadedTask = fresh.getTask(task.id);
    expect(reloadedTask?.materialId).toBe(material.id);
    expect(reloadedTask?.nodeId).toBe(node.id);
    const reloadedNode = fresh.getTaskNode(task.id);
    expect(reloadedNode?.planId).toBeNull();
    expect(reloadedNode?.taskId).toBe(task.id);
    const reloadedMaterial = fresh.getMaterial(material.id);
    expect(reloadedMaterial.taskId).toBe(task.id); // the back-link persists
    expect(reloadedMaterial.parseState).toBe("parsed");
    expect(reloadedMaterial.sections).toEqual(parsed.sections);
    expect(fresh.getReadingProgress(material.id)?.position).toEqual(position);
    const reloadedEvidence = fresh.listEvidenceByNode(node.id);
    expect(reloadedEvidence).toHaveLength(6);

    // the numbers recompute from the persisted document alone — same ADR-0001
    // verdicts through the fresh domain module
    expect(freshMastery.computeTaskRollup(reloadedEvidence)).toBe(80);
    expect(freshMastery.getNodeState(reloadedEvidence)).toBe("mastered");
    expect(fresh.listEvidenceByNode(planNode.id)).toHaveLength(0); // isolation persists too

    // bytes were memory-only: gone after reload — the reader's re-upload
    // contract, never a fake parse (mirrors the reader-loop walk)
    expect(fresh.sessionBlobs.has(material.id)).toBe(false);
  });
});

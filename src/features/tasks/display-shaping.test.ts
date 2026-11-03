import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeNode, Material, ReadingLocator, ReadingProgress, StudyTask } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { taskContinueTarget, taskMasteryView, taskOwnEvidence, tasksNewestFirst } from "./display-shaping";

/**
 * Task Home display shaping (T2; spec testing seam 2 — pure display-shaping):
 * evidence → presentation inputs, with the numbers asserted as the exact
 * ADR-0001 worked examples (window 5, cap-99 below the 3-evidence gate,
 * mastered = ≥80 & ≥3). The expected values are read from the shipped domain
 * tests (mastery.test.ts) — an independent source — never recomputed here.
 */

let seq = 0;
const ev = (nodeId: string, outcome: EvidenceRecord["outcome"], createdAt: string): EvidenceRecord => {
  seq += 1;
  return { id: `ev-${seq}`, nodeId, sessionId: null, questionId: null, outcome, createdAt };
};

const taskNode = (id: string): KnowledgeNode => ({
  id,
  planId: null,
  taskId: "t1",
  stage: null,
  title: "lecture-04",
  order: 0,
});

describe("task mastery view (AD-6/ADR-0001: the single owned node's score)", () => {
  it("no evidence reads honestly uncovered: score 0, no marks, not below the gate", () => {
    const view = taskMasteryView(taskNode("n1"), []);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("one correct caps at 99 below the gate and stays partial — 100 must mean verified mastery", () => {
    const view = taskMasteryView(taskNode("n1"), [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view.score).toBe(99); // score-level gate cap (ADR-0001 amendment)
    expect(view.state).toBe("partial"); // gate: needs ≥3 records
    expect(view.hasEvidence).toBe(true);
    expect(view.belowGate).toBe(true); // the popover names the cap
    expect(view.lastOutcomes).toEqual(["correct"]);
  });

  it("correct+correct+partial → 83 and mastered — the mastery.test.ts worked example", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(83); // 2.5/3 → 83.33 → 83, gate met, ≥80 → mastered
    expect(view.state).toBe("mastered");
    expect(view.belowGate).toBe(false);
  });

  it("the window is 5: an early wrong ages out of both the score and the marks", () => {
    const records = [
      ev("n1", "wrong", "2026-11-01T10:00:00Z"),
      ...[2, 3, 4, 5, 6].map((d) => ev("n1", "correct", `2026-11-0${d}T10:00:00Z`)),
    ];
    const view = taskMasteryView(taskNode("n1"), records);
    expect(view.score).toBe(100); // mean of the last 5 = all correct → 100, gate met
    expect(view.state).toBe("mastered");
    expect(view.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "correct"]); // oldest → newest
    expect(view.lastOutcomes).toHaveLength(MASTERY_CONFIG.window);
    expect(view.lastOutcomes).not.toContain("wrong"); // the dropped record stays out of the marks
  });

  it("two corrects: 99 partial with the cap note, marks oldest → newest", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
    ]);
    expect(view.score).toBe(99);
    expect(view.state).toBe("partial");
    expect(view.belowGate).toBe(true);
    expect(view.lastOutcomes).toEqual(["correct", "correct"]); // createdAt order, not array order
  });

  it("evidence never bleeds across nodes (AD-6): other nodes' records are invisible to the task", () => {
    const view = taskMasteryView(taskNode("n1"), [
      ev("other-node", "correct", "2026-11-01T10:00:00Z"),
      ev("other-node", "correct", "2026-11-02T10:00:00Z"),
      ev("other-node", "correct", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(0);
    expect(view.state).toBe("uncovered");
    expect(view.hasEvidence).toBe(false);
  });

  it("a missing node (bad task id) shapes to the honest uncovered zero", () => {
    expect(taskOwnEvidence(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")])).toEqual([]);
    const view = taskMasteryView(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("taskOwnEvidence keeps only the task node's own records", () => {
    const records = [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n2", "wrong", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ];
    expect(taskOwnEvidence(taskNode("n1"), records)).toEqual([records[0], records[2]]);
  });
});

/**
 * Study Tasks section selectors (T3; FR-37; spec testing seam 2 — pure
 * display-shaping): newest-first ordering, the empty-section rule at the seam,
 * and the continue-reading target. Expected hrefs are independent literals
 * cross-checked against the reader's own anchor tests (anchors.test.ts:
 * readerAnchorHref("m1", 7) === "/read/m1?page=7", readerSectionHref
 * ("m1", "getting-started") === "/read/m1#getting-started") — never recomputed.
 */
const taskAt = (id: string, createdAt: string): StudyTask => ({
  id,
  materialId: `m-${id}`,
  nodeId: `n-${id}`,
  createdAt,
});

const pdfMaterial: Material = {
  id: "m-pdf",
  title: "paper",
  kind: "pdf",
  sizeBytes: 1024,
  planId: null,
  taskId: "t1",
  parseState: "parsed",
  sections: [
    { id: "page-1", title: "p1", text: "" },
    { id: "page-3", title: "p3", text: "" },
  ],
  createdAt: "2026-11-01T09:00:00Z",
};

const mdMaterial: Material = {
  id: "m-md",
  title: "notes",
  kind: "markdown",
  sizeBytes: 1024,
  planId: null,
  taskId: "t1",
  parseState: "parsed",
  sections: [
    { id: "intro", title: "Intro", text: "" },
    { id: "recap", title: "Recap", text: "" },
  ],
  createdAt: "2026-11-01T09:00:00Z",
};

const progressAt = (materialId: string, locator: ReadingLocator, updatedAt: string): ReadingProgress => ({
  materialId,
  position: { locator, text: "extracted text" },
  updatedAt,
});

describe("tasksNewestFirst (FR-37: newest-first rows)", () => {
  it("orders newest createdAt first", () => {
    const tasks = [taskAt("t-old", "2026-11-01T10:00:00Z"), taskAt("t-new", "2026-11-02T10:00:00Z")];
    expect(tasksNewestFirst(tasks)).toEqual([tasks[1], tasks[0]]);
  });

  it("createdAt order wins over array order (a later task listed first still sorts last)", () => {
    const tasks = [taskAt("t-new", "2026-11-02T10:00:00Z"), taskAt("t-old", "2026-11-01T10:00:00Z")];
    expect(tasksNewestFirst(tasks)).toEqual([tasks[0], tasks[1]]);
  });

  it("zero tasks shapes to [] — the empty-section rule's seam (no rows, no chrome)", () => {
    expect(tasksNewestFirst([])).toEqual([]);
  });
});

describe("taskContinueTarget (FR-10: deep link at the stored position)", () => {
  it("no stored position falls back to the plain reader link, not resumable", () => {
    expect(taskContinueTarget(pdfMaterial, [])).toEqual({ href: "/read/m-pdf", resumable: false });
    expect(taskContinueTarget(mdMaterial, [])).toEqual({ href: "/read/m-md", resumable: false });
  });

  it("a pdf position deep-links ?page=N through the reader's anchor channel", () => {
    const progress = [progressAt("m-pdf", { kind: "pdf", page: 3 }, "2026-11-02T10:00:00Z")];
    expect(taskContinueTarget(pdfMaterial, progress)).toEqual({ href: "/read/m-pdf?page=3", resumable: true });
  });

  it("a markdown position deep-links #section-id", () => {
    const progress = [progressAt("m-md", { kind: "markdown", sectionId: "intro" }, "2026-11-02T10:00:00Z")];
    expect(taskContinueTarget(mdMaterial, progress)).toEqual({ href: "/read/m-md#intro", resumable: true });
  });

  it("a stale pdf page (extraction gone) falls back to the plain link — never a dead deep link", () => {
    const progress = [progressAt("m-pdf", { kind: "pdf", page: 9 }, "2026-11-02T10:00:00Z")];
    expect(taskContinueTarget(pdfMaterial, progress)).toEqual({ href: "/read/m-pdf", resumable: false });
  });

  it("a drifted markdown section id falls back to the plain link", () => {
    const progress = [progressAt("m-md", { kind: "markdown", sectionId: "gone" }, "2026-11-02T10:00:00Z")];
    expect(taskContinueTarget(mdMaterial, progress)).toEqual({ href: "/read/m-md", resumable: false });
  });

  it("other materials' progress never leaks into this task's link", () => {
    const progress = [progressAt("m-other", { kind: "pdf", page: 3 }, "2026-11-03T10:00:00Z")];
    expect(taskContinueTarget(mdMaterial, progress)).toEqual({ href: "/read/m-md", resumable: false });
  });

  it("the newest position wins when a material has several stored records", () => {
    const progress = [
      progressAt("m-pdf", { kind: "pdf", page: 1 }, "2026-11-01T10:00:00Z"),
      progressAt("m-pdf", { kind: "pdf", page: 3 }, "2026-11-02T10:00:00Z"),
    ];
    expect(taskContinueTarget(pdfMaterial, progress)).toEqual({ href: "/read/m-pdf?page=3", resumable: true });
  });
});

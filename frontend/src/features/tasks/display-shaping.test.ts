import { describe, expect, it } from "vitest";
import type { KnowledgeNodeView } from "@/api/views";
import type { EvidenceRecord, Material, ReadingLocator, ReadingProgress, StudyTask } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { taskContinueTarget, taskMasteryView, taskOwnEvidence, tasksNewestFirst } from "./display-shaping";

/**
 * Task Home display shaping (T2; spec testing seam 2 — pure display-shaping):
 * since the Apollo cutover the score and state are SERVER fields (AD-14 —
 * render, never recompute), so the mastery-view tests assert PASS-THROUGH of
 * the api's numbers plus the two things this module still derives: the marks
 * window (last 5, createdAt order) and the cap-99-below-gate note condition.
 * The window rule itself is the shipped domain contract (MASTERY_CONFIG,
 * mastery.test.ts is the independent source) — never recomputed here.
 */

let seq = 0;
const ev = (nodeId: string, outcome: EvidenceRecord["outcome"], createdAt: string): EvidenceRecord => {
  seq += 1;
  return { id: `ev-${seq}`, nodeId, sessionId: null, questionId: null, outcome, createdAt };
};

/** A server-scored task node view: the api's masteryScore/state ride along. */
const taskNode = (id: string, masteryScore: string, state: KnowledgeNodeView["state"]): KnowledgeNodeView => ({
  id,
  planId: null,
  taskId: "t1",
  stage: null,
  title: "lecture-04",
  order: 0,
  masteryScore,
  state,
});

describe("task mastery view (AD-6/AD-14: the server's score, this module's marks)", () => {
  it("a missing node (bad task id) shapes to the honest uncovered zero", () => {
    expect(taskOwnEvidence(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")])).toEqual([]);
    const view = taskMasteryView(undefined, [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("renders the server score/state verbatim — uncovered with no marks, no cap note", () => {
    const view = taskMasteryView(taskNode("n1", "0", "uncovered"), []);
    expect(view).toEqual({ score: 0, state: "uncovered", hasEvidence: false, lastOutcomes: [], belowGate: false });
  });

  it("the server score is NEVER recomputed from the evidence (AD-14)", () => {
    // three corrects would compute 99/100 client-side under the old rules —
    // the view must keep carrying the api's number untouched
    const view = taskMasteryView(taskNode("n1", "7", "partial"), [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "correct", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(7);
    expect(view.state).toBe("partial");
    expect(view.hasEvidence).toBe(true);
    expect(view.belowGate).toBe(false); // 7 < the 99 cap — the note has nothing to say
  });

  it("the capped partial (99 below the gate) names the cap in the popover", () => {
    const view = taskMasteryView(taskNode("n1", "99", "partial"), [ev("n1", "correct", "2026-11-01T10:00:00Z")]);
    expect(view.score).toBe(99); // the api's cap, verbatim
    expect(view.state).toBe("partial");
    expect(view.hasEvidence).toBe(true);
    expect(view.belowGate).toBe(true); // the popover names the cap
    expect(view.lastOutcomes).toEqual(["correct"]);
  });

  it("mastered reads the readiness state and never claims the cap", () => {
    const view = taskMasteryView(taskNode("n1", "100", "mastered"), [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(100);
    expect(view.state).toBe("mastered");
    expect(view.belowGate).toBe(false);
    expect(view.lastOutcomes).toEqual(["correct", "correct", "partial"]); // oldest → newest
  });

  it("the marks window is 5: an early wrong ages out of the popover's marks", () => {
    const records = [
      ev("n1", "wrong", "2026-11-01T10:00:00Z"),
      ...[2, 3, 4, 5, 6].map((d) => ev("n1", "correct", `2026-11-0${d}T10:00:00Z`)),
    ];
    const view = taskMasteryView(taskNode("n1", "100", "mastered"), records);
    expect(view.score).toBe(100); // server truth, indifferent to the window
    expect(view.state).toBe("mastered");
    expect(view.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "correct"]); // oldest → newest
    expect(view.lastOutcomes).toHaveLength(MASTERY_CONFIG.window);
    expect(view.lastOutcomes).not.toContain("wrong"); // the dropped record stays out of the marks
  });

  it("marks order is createdAt order, not array order", () => {
    const view = taskMasteryView(taskNode("n1", "50", "partial"), [
      ev("n1", "correct", "2026-11-02T10:00:00Z"),
      ev("n1", "wrong", "2026-11-01T10:00:00Z"),
    ]);
    expect(view.lastOutcomes).toEqual(["wrong", "correct"]); // oldest first
  });

  it("evidence never bleeds across nodes (AD-6): other nodes' records are invisible to the task", () => {
    const view = taskMasteryView(taskNode("n1", "42", "partial"), [
      ev("other-node", "correct", "2026-11-01T10:00:00Z"),
      ev("other-node", "correct", "2026-11-02T10:00:00Z"),
      ev("other-node", "correct", "2026-11-03T10:00:00Z"),
    ]);
    expect(view.score).toBe(42); // the api's number, untouched by foreign evidence
    expect(view.state).toBe("partial"); // the server state, likewise
    expect(view.hasEvidence).toBe(true); // rides the server state, not the filtered marks
    expect(view.lastOutcomes).toEqual([]); // no OWN evidence → no marks
    expect(view.belowGate).toBe(false);
  });

  it("taskOwnEvidence keeps only the task node's own records", () => {
    const records = [
      ev("n1", "correct", "2026-11-01T10:00:00Z"),
      ev("n2", "wrong", "2026-11-02T10:00:00Z"),
      ev("n1", "partial", "2026-11-03T10:00:00Z"),
    ];
    expect(taskOwnEvidence(taskNode("n1", "0", "uncovered"), records)).toEqual([records[0], records[2]]);
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
  attachmentScope: "plan",
  nodeId: null,
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
  attachmentScope: "plan",
  nodeId: null,
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

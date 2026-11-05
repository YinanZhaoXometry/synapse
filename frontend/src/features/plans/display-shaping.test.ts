import { describe, expect, it } from "vitest";
import type {
  EvidenceRecord,
  Material,
  ReadingProgress,
} from "@/domain/entities";
import type { KnowledgeNodeView, StudyPlanView } from "@/api/views";
import {
  latestReading,
  masteryRingVariant,
  mostRecentPlan,
  nodeRowViews,
  planCardMetrics,
  planRecentActivity,
  stageGroups,
} from "./display-shaping";

const plan = (id: string, createdAt: string, masteryScore = "0"): StudyPlanView => ({
  id,
  topic: `topic-${id}`,
  goal: null,
  nodeIds: [],
  materialIds: [],
  createdAt,
  masteryScore,
  visibility: "private",
  forkedFromTopic: null,
});

const node = (id: string, overrides: Partial<KnowledgeNodeView> = {}): KnowledgeNodeView => ({
  id,
  planId: "p1",
  taskId: null,
  stage: "基础",
  title: `node-${id}`,
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  ...overrides,
});

const nodeIn = (id: string, stage: string | null, order: number): KnowledgeNodeView => ({
  ...node(id),
  stage,
  order,
  title: `node-${id}`,
});

/** Evidence fixture: `n` correct records on one node (server-shaped rows). */
const evidence = (nodeId: string, correctCount: number): EvidenceRecord[] =>
  Array.from({ length: correctCount }, (_, i) => ({
    id: `${nodeId}-e${i}`,
    nodeId,
    sessionId: null,
    questionId: null,
    outcome: "correct",
    createdAt: `2026-11-01T10:0${i}:00Z`,
  }));

describe("display shaping (seam 4: server fields → presentation inputs, AD-14)", () => {
  it("most-recent-plan selection: the latest createdAt wins regardless of list order", () => {
    const plans = [plan("a", "2026-11-01T10:00:00Z"), plan("b", "2026-11-02T09:00:00Z")];
    expect(mostRecentPlan(plans)?.id).toBe("b");
    expect(mostRecentPlan([plans[1], plans[0]])?.id).toBe("b");
  });

  it("most-recent-plan selection: no plans → undefined (the empty state owns the page)", () => {
    expect(mostRecentPlan([])).toBeUndefined();
  });

  it("mastery ring variant (FR-3 display contract): exactly 100 renders as the readiness state, anything under stays brand", () => {
    expect(masteryRingVariant(100)).toBe("mastered");
    expect(masteryRingVariant(99)).toBe("brand");
    expect(masteryRingVariant(0)).toBe("brand");
  });

  it("card metrics render the SERVER rollup verbatim — no client recompute (AD-14)", () => {
    const hero = plan("p1", "2026-11-01T10:00:00Z", "33");
    const metrics = planCardMetrics(hero, [
      node("n1", { masteryScore: "100", state: "mastered" }),
      node("n2"),
      node("n3"),
    ]);
    expect(metrics.rollup).toBe(33);
    expect(metrics.stateCounts).toEqual({ mastered: 1, partial: 0, uncovered: 2 });
  });

  it("state counts shape the mini bar straight from the server states", () => {
    const hero = plan("p1", "2026-11-01T10:00:00Z", "66");
    const metrics = planCardMetrics(hero, [
      node("n1", { masteryScore: "100", state: "mastered" }),
      node("n2", { masteryScore: "99", state: "partial" }),
      node("n3"),
    ]);
    expect(metrics.stateCounts).toEqual({ mastered: 1, partial: 1, uncovered: 1 });
    expect(metrics.rollup).toBe(66);
  });
});

describe("plan home shaping (ticket 03): stage grouping + node rows", () => {
  it("stage groups keep first-appearance stage order and node order within a stage", () => {
    const rows = [
      nodeIn("a", "核心", 2),
      nodeIn("b", "基础", 0),
      nodeIn("c", "核心", 3),
      nodeIn("d", "基础", 1),
    ];
    const groups = stageGroups(rows);
    expect(groups.map((g) => g.stage)).toEqual(["核心", "基础"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("a null stage forms its own group in first-appearance position (stageless nodes are honest, not hidden)", () => {
    const rows = [nodeIn("a", null, 0), nodeIn("b", "基础", 1), nodeIn("c", null, 2)];
    const groups = stageGroups(rows);
    expect(groups.map((g) => g.stage)).toEqual([null, "基础"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("node rows: fresh node reads uncovered with the em-dash rule", () => {
    const views = nodeRowViews([node("n1")], []);
    expect(views).toHaveLength(1);
    expect(views[0].state).toBe("uncovered");
    expect(views[0].hasEvidence).toBe(false);
    expect(views[0].lastOutcomes).toEqual([]);
  });

  it("node rows: the SERVER score/state ride through; the marks keep the last-5 window (oldest → newest)", () => {
    // 6 records: the api's score window is the most recent 5, so the displayed
    // marks must be those same 5, in chronological order — score is server truth.
    const records: EvidenceRecord[] = [
      { id: "e0", nodeId: "n1", sessionId: "s1", questionId: "q0", outcome: "wrong", createdAt: "2026-11-01T10:00:00Z" },
      ...["2026-11-01T11:00:00Z", "2026-11-01T12:00:00Z", "2026-11-01T13:00:00Z", "2026-11-01T14:00:00Z"].map(
        (createdAt, i) =>
          ({ id: `e${i + 1}`, nodeId: "n1", sessionId: "s1", questionId: null, outcome: "correct", createdAt } as const),
      ),
      { id: "e5", nodeId: "n1", sessionId: "s1", questionId: "q5", outcome: "partial", createdAt: "2026-11-01T15:00:00Z" },
    ];
    const [view] = nodeRowViews([node("n1", { masteryScore: "90", state: "mastered" })], records);
    expect(view.state).toBe("mastered");
    expect(view.score).toBe(90);
    expect(view.hasEvidence).toBe(true);
    expect(view.lastOutcomes).toEqual(["correct", "correct", "correct", "correct", "partial"]);
    expect(records.some((r) => r.outcome === "wrong")).toBe(true); // the dropped record stays out of the marks
  });
});

describe("plan home shaping (ticket 03): recent activity", () => {
  const planNodes = [nodeIn("n1", "基础", 0), nodeIn("n2", "核心", 1)];

  it("groups evidence into session-ish entries, drops other plans' records, newest session first", () => {
    const records: EvidenceRecord[] = [
      { id: "e-old", nodeId: "n1", sessionId: "s1", questionId: "q1", outcome: "correct", createdAt: "2026-11-01T09:00:00Z" },
      { id: "e-old2", nodeId: "n2", sessionId: "s1", questionId: "q2", outcome: "correct", createdAt: "2026-11-01T09:05:00Z" },
      { id: "e-new", nodeId: "n1", sessionId: "s2", questionId: "q3", outcome: "partial", createdAt: "2026-11-02T10:00:00Z" },
      { id: "e-foreign", nodeId: "zz", sessionId: "s3", questionId: "q4", outcome: "correct", createdAt: "2026-11-02T11:00:00Z" },
    ];
    // the surface passes this plan's own nodes; s3 belongs to another plan's node and must drop
    const entries = planRecentActivity(planNodes, records);
    expect(entries.map((e) => e.id)).toEqual(["s2", "s1"]);
    expect(entries[0]).toMatchObject({ nodeTitle: "node-n1", recordCount: 1, latestAt: "2026-11-02T10:00:00Z" });
    expect(entries[1]).toMatchObject({ recordCount: 2 });
  });

  it("entries carry no score — the api exposes no per-session score surface (contract gap surfaced; AD-14 forbids recompute)", () => {
    const records: EvidenceRecord[] = [
      { id: "a", nodeId: "n1", sessionId: "s1", questionId: null, outcome: "correct", createdAt: "2026-11-01T09:00:00Z" },
      { id: "b", nodeId: "n2", sessionId: "s1", questionId: null, outcome: "partial", createdAt: "2026-11-01T09:05:00Z" },
    ];
    const entries = planRecentActivity(planNodes, records);
    expect(entries[0]).not.toHaveProperty("score");
    expect(entries[0].recordCount).toBe(2);
  });

  it("sessionless records each form their own entry; nothing at all → empty shell", () => {
    const records: EvidenceRecord[] = [
      { id: "r1", nodeId: "n1", sessionId: null, questionId: null, outcome: "wrong", createdAt: "2026-11-01T08:00:00Z" },
      { id: "r2", nodeId: "n1", sessionId: null, questionId: null, outcome: "correct", createdAt: "2026-11-01T08:30:00Z" },
    ];
    const entries = planRecentActivity(planNodes, records);
    expect(entries.map((e) => e.id)).toEqual(["evidence-r2", "evidence-r1"]);
    expect(planRecentActivity(planNodes, [])).toEqual([]);
  });
});

describe("continue-hero shaping (ticket 04): latestReading across plans", () => {
  const pdfMaterial = (id: string, pages: number[]): Material => ({
    id,
    title: `material-${id}`,
    kind: "pdf",
    sizeBytes: 10,
    planId: "p1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    sections: pages.map((n) => ({ id: `page-${n}`, title: `Page ${n}`, text: `page ${n} text` })),
    createdAt: "2026-11-01T00:00:00Z",
  });

  const mdMaterial = (id: string, sectionIds: string[]): Material => ({
    id,
    title: `material-${id}`,
    kind: "markdown",
    sizeBytes: 10,
    planId: "p1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    sections: sectionIds.map((sid) => ({ id: sid, title: `节 ${sid}`, text: `${sid} text` })),
    createdAt: "2026-11-01T00:00:00Z",
  });

  const progress = (
    materialId: string,
    updatedAt: string,
    locator: ReadingProgress["position"]["locator"],
  ): ReadingProgress => ({
    materialId,
    position: { locator, text: "grounded text" },
    updatedAt,
  });

  it("no progress (or none resumable) → null — the line hides honestly", () => {
    expect(latestReading([], [])).toBeNull();
    expect(latestReading([], [pdfMaterial("m1", [1])])).toBeNull();
    expect(latestReading([progress("gone", "2026-11-02T10:00:00Z", { kind: "pdf", page: 1 })], [])).toBeNull();
  });

  it("the most recent updatedAt wins, regardless of list order", () => {
    const materials = [pdfMaterial("m1", [1, 2]), pdfMaterial("m2", [3])];
    const records = [
      progress("m1", "2026-11-01T10:00:00Z", { kind: "pdf", page: 2 }),
      progress("m2", "2026-11-02T09:00:00Z", { kind: "pdf", page: 3 }),
    ];
    expect(latestReading(records, materials)?.material.id).toBe("m2");
    expect(latestReading([...records].reverse(), materials)?.material.id).toBe("m2");
  });

  it("a pdf view carries the page locator and no section title; markdown carries the section title", () => {
    const materials = [pdfMaterial("m1", [1, 2]), mdMaterial("m2", ["intro", "recap"])];
    const pdf = latestReading(
      [progress("m1", "2026-11-01T10:00:00Z", { kind: "pdf", page: 2 })],
      materials,
    );
    expect(pdf?.locator).toEqual({ kind: "pdf", page: 2 });
    expect(pdf?.sectionTitle).toBeNull();
    const md = latestReading(
      [progress("m2", "2026-11-01T10:00:00Z", { kind: "markdown", sectionId: "recap" })],
      materials,
    );
    expect(md?.locator).toEqual({ kind: "markdown", sectionId: "recap" });
    expect(md?.sectionTitle).toBe("节 recap");
  });

  it("deleted material: the row is skipped and an older resumable reading answers instead", () => {
    const materials = [pdfMaterial("m1", [1])];
    const records = [
      progress("deleted", "2026-11-02T10:00:00Z", { kind: "pdf", page: 1 }),
      progress("m1", "2026-11-01T10:00:00Z", { kind: "pdf", page: 1 }),
    ];
    expect(latestReading(records, materials)?.material.id).toBe("m1");
    // only the deleted one → nothing to promise
    expect(latestReading([records[0]], materials)).toBeNull();
  });

  it("stale material: extraction lost (failed parse cleared the sections) is not resumable", () => {
    const failed = { ...pdfMaterial("m1", [1]), parseState: "failed" as const, sections: [] };
    const records = [progress("m1", "2026-11-02T10:00:00Z", { kind: "pdf", page: 1 })];
    expect(latestReading(records, [failed])).toBeNull();
  });

  it("slug drift: a markdown sectionId that no longer exists is skipped like stale progress", () => {
    const records = [
      progress("m2", "2026-11-02T10:00:00Z", { kind: "markdown", sectionId: "old-slug" }),
      progress("m1", "2026-11-01T10:00:00Z", { kind: "pdf", page: 1 }), // older but resumable
    ];
    expect(latestReading(records, [mdMaterial("m2", ["intro", "recap"]), pdfMaterial("m1", [1])])?.material.id).toBe(
      "m1",
    );
  });

  it("an empty section title (a bare # heading) reads as no section — the line shows the material alone", () => {
    const untitled = mdMaterial("m3", ["empty"]);
    untitled.sections[0].title = "";
    const view = latestReading(
      [progress("m3", "2026-11-02T10:00:00Z", { kind: "markdown", sectionId: "empty" })],
      [untitled],
    );
    expect(view).not.toBeNull(); // still resumable — the section exists
    expect(view?.sectionTitle).toBeNull(); // but the title is honest null, never ""
  });
});

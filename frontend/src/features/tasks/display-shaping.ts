/**
 * Task Home display shaping (T2; AD-6, ADR-0001): presentation inputs for the
 * task's exactly-one owned node. Since the Apollo cutover (epic P2-8 T1) the
 * score and state are SERVER fields (AD-14: render, never recompute) — this
 * module shapes them for display and keeps zero mastery arithmetic. The AD-6
 * boundary holds structurally: the task view carries only its own node.
 */
import type { EvidenceRecord, Material, Outcome, ReadingProgress } from "@/domain/entities";
import type { KnowledgeNodeView, StudyTaskView } from "@/api/views";
import { readerAnchorHref, readerSectionHref } from "@/features/reader";

/** The task's own evidence only (AD-6): records attributed to its single node. */
export function taskOwnEvidence(node: KnowledgeNodeView | undefined, evidence: EvidenceRecord[]): EvidenceRecord[] {
  if (!node) return [];
  return evidence.filter((record) => record.nodeId === node.id);
}

/** One Task-Home mastery presentation input (MasteryRing + state glyph + evidence popover). */
export interface TaskMasteryView {
  /** The task rollup — exactly the single owned node's SERVER score (AD-14). */
  score: number;
  state: KnowledgeNodeView["state"];
  hasEvidence: boolean;
  /** The score window's outcome marks, oldest → newest (evidence popover). */
  lastOutcomes: Outcome[];
  /**
   * True when real evidence exists but the score sits at the api's 99 cap
   * while the node is not yet mastered — the anti-inflation/freshness cap is
   * in effect and the popover says so (ADR-0001 cap behavior, server-applied).
   */
  belowGate: boolean;
}

/**
 * The view over the task's own evidence: score/state straight off the server
 * node view; the marks re-derive the score window (last 5) so popover and
 * number always agree (the plans nodeRowViews precedent).
 */
export function taskMasteryView(node: KnowledgeNodeView | undefined, evidence: EvidenceRecord[]): TaskMasteryView {
  const records = taskOwnEvidence(node, evidence);
  const window = [...records]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)
    .map((r) => r.outcome);
  return {
    score: node ? Number(node.masteryScore) : 0,
    state: node?.state ?? "uncovered",
    hasEvidence: node ? node.state !== "uncovered" : false,
    lastOutcomes: window.reverse(),
    belowGate: Boolean(node) && node!.state !== "mastered" && node!.state !== "uncovered" && Number(node!.masteryScore) >= 99,
  };
}

// -- Plans Home Study Tasks section (T3; FR-37) ------------------------------

/** The Study Tasks section's row order: newest createdAt first. */
export function tasksNewestFirst<T extends { createdAt: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Where a task row's continue-reading link points (FR-10) + its honest label split. */
export interface TaskContinueTarget {
  href: string;
  /**
   * True when a stored position resolved into a deep link → 「继续阅读」;
   * false when the link is the plain reader fallback → 「打开」.
   */
  resumable: boolean;
}

/**
 * The continue-reading target for a task's material (FR-10; FR-25's
 * single-material twin): the latest stored position deep-links through the
 * reader's anchor channel (?page=N / #section-id) when it still resolves
 * against the material's extraction — a stale section id (re-parse drift or a
 * lost extraction) falls back to the plain reader link, never promising a
 * destination the reader cannot land on (the plans `latestReading` rule).
 * No stored position → the plain link (resumable: false).
 */
export function taskContinueTarget(material: Material, progress: ReadingProgress[]): TaskContinueTarget {
  const plain: TaskContinueTarget = { href: `/read/${encodeURIComponent(material.id)}`, resumable: false };
  const record = [...progress]
    .filter((p) => p.materialId === material.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (!record) return plain;
  const { locator } = record.position;
  const sectionId = locator.kind === "pdf" ? `page-${Math.max(1, Math.floor(locator.page))}` : locator.sectionId;
  if (!material.sections.some((s) => s.id === sectionId)) return plain;
  return {
    href:
      locator.kind === "pdf"
        ? readerAnchorHref(material.id, locator.page)
        : readerSectionHref(material.id, locator.sectionId),
    resumable: true,
  };
}

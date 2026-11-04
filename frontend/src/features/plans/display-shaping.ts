/**
 * Display shaping (spec testing seam 4; AD-6): server data → presentation
 * inputs. Since the Apollo cutover (epic P2-8 T1) the Mastery Score and node
 * state are computed by the api (ADR-0001, AD-14): this module shapes those
 * server fields for rendering and keeps zero mastery arithmetic — the score
 * functions (computeNodeScore/computePlanRollup/getNodeState) are gone from
 * the runtime; the evidence window marks remain the one client-side derivation
 * (presentation only — which marks to show, never a score).
 */
import type {
  EvidenceRecord,
  KnowledgeNode,
  Material,
  Outcome,
  ReadingLocator,
  ReadingProgress,
} from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import type { KnowledgeNodeView, StudyPlanView } from "@/api/views";

/** The continue hero's plan: most recent by createdAt. */
export function mostRecentPlan(plans: StudyPlanView[]): StudyPlanView | undefined {
  return [...plans].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

/** MasteryRing's palette decision (DESIGN.md display contract; FR-3): 100% is the readiness state. */
export type MasteryRingVariant = "brand" | "mastered";

export function masteryRingVariant(rollup: number): MasteryRingVariant {
  return rollup >= 100 ? "mastered" : "brand";
}

/** One card/hero's presentation inputs (rollup chip + node-state mini bar). */
export interface PlanCardMetrics {
  rollup: number;
  stateCounts: Record<"mastered" | "partial" | "uncovered", number>;
}

/**
 * Rollup + state counts from SERVER fields (AD-14): the plan's rollup rides
 * `masteryScore` (the api's floored mean, uncovered nodes counting 0) and the
 * state counts tally the api's per-node states. No client recompute.
 */
export function planCardMetrics(plan: StudyPlanView, nodes: KnowledgeNodeView[]): PlanCardMetrics {
  const stateCounts: PlanCardMetrics["stateCounts"] = { mastered: 0, partial: 0, uncovered: 0 };
  for (const n of nodes) stateCounts[n.state] += 1;
  return { rollup: Number(plan.masteryScore), stateCounts };
}

/** One Plan-Home node row's presentation inputs (glyph/tint/label + score + evidence marks). */
export interface NodeRowView {
  node: KnowledgeNodeView;
  /** The node's stage, flattened for stage grouping (null = untitled group). */
  stage: string | null;
  /** The SERVER score (ADR-0001) — shown only when hasEvidence (em dash otherwise, UX display contract). */
  score: number;
  state: KnowledgeNodeView["state"];
  hasEvidence: boolean;
  /** The score window's outcome marks, oldest → newest (evidence popover). */
  lastOutcomes: Outcome[];
}

/**
 * Per-node rows: score/state straight off the server view (AD-14); the marks
 * re-derive the same recency window the score uses (MASTERY_CONFIG.window) so
 * popover and number always agree — presentation over evidence, never a score.
 */
export function nodeRowViews(nodes: KnowledgeNodeView[], evidence: EvidenceRecord[]): NodeRowView[] {
  return nodes.map((node) => {
    const records = evidence.filter((r) => r.nodeId === node.id);
    const window = [...records]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MASTERY_CONFIG.window)
      .map((r) => r.outcome);
    return {
      node,
      stage: node.stage,
      score: Number(node.masteryScore),
      state: node.state,
      hasEvidence: node.state !== "uncovered",
      lastOutcomes: window.reverse(),
    };
  });
}

/** Stage-grouped rows in first-appearance stage order; node order preserved within a stage. */
export interface StageGroup<T> {
  /** null = the plan draft carried no stage (renders as the untitled group). */
  stage: string | null;
  rows: T[];
}

export function stageGroups<T extends { stage: string | null }>(rows: T[]): StageGroup<T>[] {
  const groups: StageGroup<T>[] = [];
  const byStage = new Map<string, StageGroup<T>>();
  for (const row of rows) {
    // sentinel can never collide with a real stage name
    const key = JSON.stringify(row.stage); // quoted form cannot collide across null vs strings
    let group = byStage.get(key);
    if (!group) {
      group = { stage: row.stage, rows: [] };
      byStage.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** One recent-activity entry: a graded session (or one sessionless record). */
export interface ActivityEntry {
  /** sessionId when the records share one, else `evidence-<recordId>`. */
  id: string;
  nodeTitle: string;
  recordCount: number;
  latestAt: string;
}

export const ACTIVITY_LIMIT = 5;

/**
 * Recent graded activity for one plan (Q7): the plan's evidence grouped by
 * session, newest first, capped for display. The per-session score is gone —
 * the api exposes no session-score surface (surfaced as a contract gap on the
 * epic tracker), and AD-14 forbids re-deriving scores client-side.
 */
export function planRecentActivity(
  nodes: KnowledgeNode[],
  evidence: EvidenceRecord[],
  limit: number = ACTIVITY_LIMIT,
): ActivityEntry[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const groups = new Map<string, EvidenceRecord[]>();
  for (const record of evidence) {
    if (!nodeIds.has(record.nodeId)) continue;
    const key = record.sessionId ?? `evidence-${record.id}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  return [...groups.entries()]
    .map(([id, records]) => ({
      id,
      nodeTitle: titles.get(records[0].nodeId) ?? records[0].nodeId,
      recordCount: records.length,
      latestAt: records.reduce((latest, r) => (r.createdAt > latest ? r.createdAt : latest), records[0].createdAt),
    }))
    .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1))
    .slice(0, limit);
}

/** The continue hero's 「上次读到」 line (FR-25; T4): the most recent reading across plans. */
export interface LatestReadingView {
  material: Material;
  locator: ReadingLocator;
  /**
   * The markdown locator's section title (material data); null for pdf pages
   * AND for an empty title (a bare `#` heading has none — the line falls back
   * to the material alone rather than rendering a dangling 「· 」).
   */
  sectionTitle: string | null;
  updatedAt: string;
}

/**
 * The most recent RESUMABLE reading across all plans (FR-25): progress rows
 * sorted newest-first, walked until one resolves against its material — a row
 * whose material was deleted, lost its extraction (failed/pending parse
 * cleared the sections), or points at a section id that no longer exists
 * (slug drift after a re-parse) is stale and skipped, so the line never
 * promises a destination the reader cannot land on. None resolvable → null
 * (the line hides honestly).
 */
export function latestReading(progress: ReadingProgress[], materials: Material[]): LatestReadingView | null {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const candidates = [...progress].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  for (const record of candidates) {
    const material = byId.get(record.materialId);
    if (!material) continue; // deleted material — no destination (AD-4 honesty)
    const { locator } = record.position;
    const sectionId = locator.kind === "pdf" ? `page-${Math.max(1, Math.floor(locator.page))}` : locator.sectionId;
    const section = material.sections.find((s) => s.id === sectionId);
    if (!section) continue; // extraction gone or the section id drifted — not resumable
    return {
      material,
      locator,
      sectionTitle: locator.kind === "markdown" && section.title ? section.title : null,
      updatedAt: record.updatedAt,
    };
  }
  return null;
}

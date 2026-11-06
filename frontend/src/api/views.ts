/**
 * Server-score-carrying views over the domain entities (AD-14): the Mastery
 * Score and node state are computed by the api's Mastery module (ADR-0001) —
 * the client renders them, never recomputes. The view types extend the domain
 * entities with those server fields so feature rendering keeps its Phase-1
 * shape while every number is server truth.
 */
import type { KnowledgeNode, QuizSession, StudyPlan, StudyTask } from "@/domain/entities";
import type { Material, Question, SectionMarking } from "@/domain/entities";
import type { AnnotationRange } from "@/domain/annotation-range";

/** Node Mastery Score as the api carries it: integer percent string "0".."100". */
export type MasteryScoreString = string;

export interface KnowledgeNodeView extends KnowledgeNode {
  masteryScore: MasteryScoreString;
  state: "uncovered" | "partial" | "mastered";
  /**
   * epic-16 (FR-5): the node's one-line roadmap description — null on legacy
   * nodes (the field is a new-generation artifact, never backfilled). Server
   * truth, rendered verbatim, never derived.
   */
  description: string | null;
  /**
   * epic-16 (FR-5): whether the node may be skipped without losing the
   * thread (the dashed-node vocabulary's data half). Server truth, default
   * false, never derived.
   */
  optional: boolean;
}

/**
 * One persisted plan edge (epic-16, FR-5 data half): a from→to
 * learning-order dependency between two of the plan's nodes, endpoint uuids
 * verbatim from the api. A zero-edge plan renders via the client's
 * derived-sequence fallback (the legacy layout path).
 */
export interface PlanEdgeView {
  fromNodeId: string;
  toNodeId: string;
}

export interface StudyPlanView extends StudyPlan {
  masteryScore: MasteryScoreString;
  /**
   * FR-38 (epic P2-11 T1): the server's visibility column — "private"
   * (default) or "public" (the Square opt-in). Server truth, never derived.
   */
  visibility: "private" | "public";
  /**
   * OQ-12 (epic P2-11 T3): the fork-time topic snapshot of the Square source
   * — set only on adopted plans; null otherwise. Server truth (the
   * forkedFromTopic field), rendered as the attribution line, never re-derived.
   */
  forkedFromTopic: string | null;
  /**
   * epic-16 (FR-5): the plan's prerequisite edges — the DAG layout's input,
   * selected per-plan by edge presence (zero edges → the legacy fallback).
   * Detail reads carry the server rows; list rows ride empty here the same
   * way nodeIds do (associations realize on the Plan detail query).
   */
  edges: PlanEdgeView[];
}

export interface StudyTaskView extends StudyTask {
  /** The task's single auto-owned node (AD-6) — read off the task, never re-derived. */
  node: KnowledgeNodeView;
  /**
   * The promotion pointer (FR-37 stretch, epic-14 T2): the plan this task
   * became — null while the task is plan-free. The promoted state is
   * INFERRED from this server field, never derived client-side.
   */
  promotedPlanId: string | null;
  /** When the promotion happened — set exactly with promotedPlanId. */
  promotedAt: string | null;
  /** The promoted-into plan (the pointer card's title + deep-link target). */
  promotedPlan: { id: string; topic: string } | null;
}

/** Material with the presigned GET the reader needs for the original bytes (epic P2-6). */
export interface MaterialView extends Material {
  /** Short-lived presigned URL, minted per request; null until the blob is attached. */
  downloadUrl: string | null;
}

/** Session with its questions hydrated in generation order (the driver's grading input). */
export interface QuizSessionView extends QuizSession {
  questions: Question[];
}

/**
 * One material section's node-mapping state (FR-45, epic P2-10 T1; delta
 * decision 4): the AI map run proposes, the user confirms or rejects — the
 * row IS the durable proposal. ONE ACTIVE row per user+material+section:
 * `rejected` sections are never re-proposed, `confirmed` mappings never
 * overwritten. `nodeId` set ⇒ confirmed (or a proposed row already pointed
 * at an existing node, awaiting the verdict); `proposedNodeTitle` names the
 * coverage gap; both null on a proposal = the explicit Unmapped group.
 */
export interface MaterialNodeMappingView {
  id: string;
  materialId: string;
  nodeId: string | null;
  sectionId: string;
  proposedNodeTitle: string | null;
  status: "proposed" | "confirmed" | "rejected";
  createdAt: string;
}

/**
 * One structured enrichment marker (FR-40, epic P2-12 T1; delta decision 1 —
 * markers-only v1): where the model placed a visual and what it should show.
 * The body keeps the [[enrich|…]] lines verbatim; this array is the
 * structured read. "user" rides a user-requested annotation (the enrichAt
 * input), not the model's choice.
 */
export interface NoteMarkerView {
  kind: string;
  suggestion: string;
}

/**
 * One AI-authored Markdown study note (FR-40): standalone, exportable,
 * user-scoped. One scope per note (the server's exactly-one check) —
 * `scopeId` is the id of the plan/node/material it grounds on. The body is
 * exportable verbatim, markers included.
 */
export interface NoteView {
  id: string;
  title: string;
  body: string;
  scope: "plan" | "node" | "material";
  scopeId: string;
  enrichment: NoteMarkerView[];
  targeting: unknown;
  createdAt: string;
}

/**
 * One distilled Study Focus item (FR-17, epic-13 T4): title + detail +
 * the server-owned deep-link address — sourceRange rides the source
 * annotation's range jsonb verbatim (the AD-2 shape); null when the
 * source annotation predates ranges (a text-only, unlinkable item).
 */
export interface StudyFocusItemView {
  id: string;
  title: string;
  detail: string;
  sourceRange: AnnotationRange | null;
}

/**
 * The ONE active Study Focus set for a user+material (FR-17): core items
 * distilled from the material's annotations. Regeneration replaces the
 * items in place and bumps `generation` (the wire's vN chip).
 */
export interface StudyFocusSetView {
  id: string;
  materialId: string;
  generation: number;
  items: StudyFocusItemView[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One Mastery Marking claim row (FR-15, epic-15 T2): the wire's SectionMarking
 * matches the dormant domain interface exactly (`claimedAt`/`clearedAt` ride
 * as plain strings per the codegen scalar config) — no field is missing, so
 * the view IS the domain type and the alias keeps the hooks layer's view
 * vocabulary. `clearedAt` null = the claim is open (the client derives open
 * claims from the rows — rows are history, unmarking never deletes); no
 * mastery field can exist here (a claim is NEVER evidence, AD-14).
 */
export type SectionMarkingView = SectionMarking;

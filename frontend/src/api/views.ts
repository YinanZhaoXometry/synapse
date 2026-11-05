/**
 * Server-score-carrying views over the domain entities (AD-14): the Mastery
 * Score and node state are computed by the api's Mastery module (ADR-0001) —
 * the client renders them, never recomputes. The view types extend the domain
 * entities with those server fields so feature rendering keeps its Phase-1
 * shape while every number is server truth.
 */
import type { KnowledgeNode, QuizSession, StudyPlan, StudyTask } from "@/domain/entities";
import type { Material, Question } from "@/domain/entities";

/** Node Mastery Score as the api carries it: integer percent string "0".."100". */
export type MasteryScoreString = string;

export interface KnowledgeNodeView extends KnowledgeNode {
  masteryScore: MasteryScoreString;
  state: "uncovered" | "partial" | "mastered";
}

export interface StudyPlanView extends StudyPlan {
  masteryScore: MasteryScoreString;
  /**
   * FR-38 (epic P2-11 T1): the server's visibility column — "private"
   * (default) or "public" (the Square opt-in). Server truth, never derived.
   */
  visibility: "private" | "public";
}

export interface StudyTaskView extends StudyTask {
  /** The task's single auto-owned node (AD-6) — read off the task, never re-derived. */
  node: KnowledgeNodeView;
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

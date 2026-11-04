/**
 * Server-score-carrying views over the domain entities (AD-14): the Mastery
 * Score and node state are computed by the api's Mastery module (ADR-0001) —
 * the client renders them, never recomputes. The view types extend the domain
 * entities with those server fields so feature rendering keeps its Phase-1
 * shape while every number is server truth.
 */
import type { KnowledgeNode, StudyPlan, StudyTask } from "@/domain/entities";
import type { Material } from "@/domain/entities";

/** Node Mastery Score as the api carries it: integer percent string "0".."100". */
export type MasteryScoreString = string;

export interface KnowledgeNodeView extends KnowledgeNode {
  masteryScore: MasteryScoreString;
  state: "uncovered" | "partial" | "mastered";
}

export interface StudyPlanView extends StudyPlan {
  masteryScore: MasteryScoreString;
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

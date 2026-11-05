/**
 * Pure domain types — the single source of truth for entity shapes.
 * No React imports (AD-2); entities are language-neutral (AD-9).
 * Ownership lives in the data repositories (AD-3); this file only declares.
 * Names follow the architecture spine's ER diagram + GLOSSARY.md vocabulary.
 */

import type { AnnotationRange } from "./annotation-range";

export type Outcome = "correct" | "partial" | "wrong";

export type NodeState = "uncovered" | "partial" | "mastered";

/** Domain locator type (AD-2): where in a Material a position sits. */
export type ReadingLocator =
  | { kind: "pdf"; page: number }
  | { kind: "markdown"; sectionId: string };

/**
 * ReadingPosition (AD-2): locator + its extracted text. Consumed verbatim by
 * the reader's tracker, persisted ReadingProgress, and CompanionService grounding.
 */
export interface ReadingPosition {
  locator: ReadingLocator;
  text: string;
}

/** Extracted section of a Material; text is bounded per-section (AD-4 quota safety). */
export interface MaterialSection {
  id: string; // stable section id: markdown slug or `page-N` for PDF
  title: string;
  text: string;
}

export type ParseState = "pending" | "parsing" | "parsed" | "failed";

/**
 * Why a parse failed (reader parse(file) API, AD-7). Persisted on the Material
 * (optional field — no schema change) so a failed row stays honest after a reload.
 */
export type ParseFailureReason = "corrupt" | "encrypted" | "empty" | "unknown";

/**
 * Where a Material's content feeds (FR-44, epic P2-10 T2): "plan" rides every
 * plan-scoped generation surface; "node" is pinned to exactly one node
 * (nodeId) — the api's ContextAssembler enforces the split at assembly time.
 */
export type AttachmentScope = "plan" | "node";

export interface Material {
  id: string;
  title: string;
  kind: "pdf" | "markdown";
  sizeBytes: number;
  /** Plan-wide attachment (FR-2 default); pinned attachment is FR-44 (epic P2-10 T2). */
  planId: string | null;
  taskId: string | null;
  /**
   * Where the content feeds (FR-44, server field): "plan" — the whole plan's
   * generation surfaces (the default) — or "node" — only the pinned node's.
   */
  attachmentScope: AttachmentScope;
  /** The pinned plan node — set only while attachmentScope is "node". */
  nodeId: string | null;
  parseState: ParseState;
  /** Set only while parseState is "failed" — the bilingual reason lives in i18n (NFR-5). */
  parseFailureReason?: ParseFailureReason;
  sections: MaterialSection[];
  createdAt: string; // ISO 8601
}

export interface KnowledgeNode {
  id: string;
  /** null for a Study Task's owned node (AD-6: task owns exactly one node). */
  planId: string | null;
  /** Set only on a Study Task's single auto-created node. */
  taskId: string | null;
  /** Stage grouping from the plan structure (e.g. 基础/核心/进阶/应用). */
  stage: string | null;
  title: string;
  order: number;
}

export interface StudyPlan {
  id: string;
  topic: string;
  goal: string | null;
  nodeIds: string[];
  materialIds: string[];
  createdAt: string;
}

export interface StudyTask {
  id: string;
  materialId: string;
  /** The task's exactly-one owned KnowledgeNode (AD-6). */
  nodeId: string;
  createdAt: string;
}

export interface Question {
  id: string;
  sessionId: string;
  /** Node attribution at generation time — required (AD-6). */
  nodeId: string;
  kind: "open" | "choice";
  prompt: string;
  /** Choice questions; single-select in Phase 1. */
  options?: string[];
  correctOptionIndex?: number;
  /** Materials-sourced provenance (FR-18/NFR-1). */
  sourceMaterialId: string;
  sourceSectionId: string;
  /** Open-answer grading keywords (simulated adapter contract, AD-5). */
  keywords?: string[];
  explanation: string;
}

export interface QuizSession {
  id: string;
  planId: string | null;
  taskId: string | null;
  mode: "open" | "choice" | "mix";
  questionIds: string[];
  status: "active" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
}

/**
 * The only unit that moves a Mastery Score (GLOSSARY). One graded quiz answer,
 * node-attributed. A forfeit (「看答案」) is recorded as outcome "wrong".
 */
export interface EvidenceRecord {
  id: string;
  /** Required in Phase 1 (AD-6). */
  nodeId: string;
  sessionId: string | null;
  questionId: string | null;
  outcome: Outcome;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  materialId: string;
  nodeId: string | null;
  front: string;
  back: string;
  /** Self-rating only — persists here, never creates EvidenceRecords. */
  difficulty: "hard" | "medium" | "easy" | null;
  createdAt: string;
}

export interface MistakeEntry {
  id: string;
  questionId: string;
  sessionId: string | null;
  nodeId: string;
  userAnswer: string;
  /** FR-23: every mistake carries its source location. */
  sourceLocation: ReadingLocator;
  /** 「看答案 = 放弃」 — graded wrong, no mastery credit (FR-18 stance). */
  forfeited: boolean;
  createdAt: string;
}

export interface ReadingProgress {
  /** 1:1 with a Material (spine ER). */
  materialId: string;
  position: ReadingPosition;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "companion";
  text: string;
  citations: ReadingLocator[];
  createdAt: string;
}

export interface ChatThread {
  /** 1:1 anchor to a Material (spine ER); plan-creation transcripts are ephemeral (AD-5). */
  materialId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

/**
 * Mastery Marking claim (FR-15): a claim, never evidence — it can never move a score.
 * Phase 2 feature; the type is declared now so persistence carries it unchanged.
 */
export interface SectionMarking {
  id: string;
  materialId: string;
  sectionId: string;
  claimedAt: string;
  clearedAt: string | null;
}

/**
 * One user annotation (FR-16, epic-13 T3): a multi-color highlight or an
 * underline, user-scoped, pinned by char offsets — the AD-2 range
 * (domain/annotation-range.ts) anchors it to the markdown section's stable
 * text or the pdf page's text-layer string, with the quote for drift
 * verification. `color` is a named palette key (the engine's chips
 * vocabulary; null rides the reader default); `body` is the free-text note
 * (empty for pure highlights — the note editor stays a v2).
 */
export interface Annotation {
  id: string;
  materialId: string;
  locator: ReadingLocator;
  range: AnnotationRange;
  kind: "highlight" | "underline";
  color: string | null;
  body: string;
  createdAt: string;
}

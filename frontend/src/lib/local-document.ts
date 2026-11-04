/**
 * Read-only accessor for the legacy local document (`synapse-db:v1`) — the
 * Phase-1 persistence. The Apollo cutover (epic P2-8) retires it from the
 * runtime, but the document itself is NEVER deleted (rollback substrate,
 * AD-20), and two readers keep it honest:
 *   - the entry gate's first-run flag (until ticket 02's login wall re-shapes
 *     entry state),
 *   - ticket 03's first-login import, whose whole job is carrying this
 *     document to the api.
 * Only this module touches the key — the grep guard pins that.
 *
 * The import half (AD-4/AD-15): the document's shape IS the contract. The
 * full reader hands the whole document to the offer; the input mapper passes
 * every collection through verbatim (client uuids are the keys, AD-12) and
 * strips only what the server realizes as associations (plan.nodeIds /
 * plan.materialIds live in the rows' planId/taskId links). Materials travel
 * WITHOUT bytes — the re-attach invite restores them (epic-06 presign).
 */
import type { DocumentInput } from "@/types/graphql";

export const LOCAL_DOC_KEY = "synapse-db:v1";

/** The entry-gate flag, read straight off the local document (AD-8). */
export function readLocalOnboardingComplete(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_DOC_KEY);
    if (!raw) return false;
    const doc = JSON.parse(raw) as { onboardingComplete?: boolean };
    return doc.onboardingComplete === true;
  } catch {
    return false;
  }
}

/** The Phase-1 document shape (the retired src/data SynapseDb, verbatim).
 * Collections stay optional: a corrupt or partial document reads as what it
 * is — the offer gate treats missing collections as empty. */
export interface LegacyDocument {
  version: number;
  onboardingComplete: boolean;
  plans?: LegacyPlanRow[];
  nodes?: LegacyNodeRow[];
  materials?: LegacyMaterialRow[];
  tasks?: LegacyTaskRow[];
  sessions?: LegacySessionRow[];
  questions?: LegacyQuestionRow[];
  evidence?: LegacyEvidenceRow[];
  flashcards?: LegacyFlashcardRow[];
  mistakes?: LegacyMistakeRow[];
  readingProgress?: LegacyReadingProgressRow[];
  chatThreads?: LegacyChatThreadRow[];
  sectionMarkings?: LegacySectionMarkingRow[];
}

export interface LegacyPlanRow {
  id: string;
  topic: string;
  goal: string | null;
  nodeIds?: string[];
  materialIds?: string[];
  createdAt: string;
}

export interface LegacyNodeRow {
  id: string;
  planId: string | null;
  taskId: string | null;
  stage: string | null;
  title: string;
  order: number;
}

export interface LegacyMaterialRow {
  id: string;
  title: string;
  kind: "pdf" | "markdown";
  sizeBytes: number;
  planId: string | null;
  taskId: string | null;
  parseState: "pending" | "parsing" | "parsed" | "failed";
  parseFailureReason?: string;
  sections: Array<{ id: string; title: string; text: string }>;
  createdAt: string;
}

export interface LegacyTaskRow {
  id: string;
  materialId: string;
  nodeId: string;
  createdAt: string;
}

export interface LegacySessionRow {
  id: string;
  planId: string | null;
  taskId: string | null;
  mode: "open" | "choice" | "mix";
  questionIds: string[];
  status: "active" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
}

export interface LegacyQuestionRow {
  id: string;
  sessionId: string;
  nodeId: string;
  kind: "open" | "choice";
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  sourceMaterialId: string;
  sourceSectionId: string;
  keywords?: string[];
  explanation: string;
}

export interface LegacyEvidenceRow {
  id: string;
  nodeId: string;
  sessionId: string | null;
  questionId: string | null;
  outcome: "correct" | "partial" | "wrong";
  createdAt: string;
}

export interface LegacyFlashcardRow {
  id: string;
  materialId: string;
  nodeId: string | null;
  front: string;
  back: string;
  difficulty: "hard" | "medium" | "easy" | null;
  createdAt: string;
}

export interface LegacyMistakeRow {
  id: string;
  questionId: string;
  sessionId: string | null;
  nodeId: string;
  userAnswer: string;
  sourceLocation: LegacyLocator;
  forfeited: boolean;
  createdAt: string;
}

export interface LegacyReadingProgressRow {
  materialId: string;
  position: { locator: LegacyLocator; text: string };
  updatedAt: string;
}

export interface LegacyChatThreadRow {
  materialId: string;
  messages: Array<{
    id: string;
    role: "user" | "companion";
    text: string;
    citations: LegacyLocator[];
    createdAt: string;
  }>;
  updatedAt: string;
}

export interface LegacySectionMarkingRow {
  id: string;
  materialId: string;
  sectionId: string;
  claimedAt: string;
  clearedAt: string | null;
}

/** The AD-2 locator: {kind:"pdf", page} | {kind:"markdown", sectionId}. */
export interface LegacyLocator {
  kind: "pdf" | "markdown";
  page?: number;
  sectionId?: string;
}

/** The whole-document reader for the first-login import. Null when the key
 * is absent or corrupt (never throws, never writes — the document is the
 * rollback substrate, AD-20). */
export function readLocalDocument(): LegacyDocument | null {
  try {
    const raw = localStorage.getItem(LOCAL_DOC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LegacyDocument;
  } catch {
    return null;
  }
}

/** True when the document holds at least one row anywhere — an empty (or
 * absent-shaped) document has nothing to carry, so no offer. */
export function localDocumentHasData(doc: LegacyDocument): boolean {
  return (
    (doc.plans?.length ?? 0) > 0 ||
    (doc.nodes?.length ?? 0) > 0 ||
    (doc.materials?.length ?? 0) > 0 ||
    (doc.tasks?.length ?? 0) > 0 ||
    (doc.sessions?.length ?? 0) > 0 ||
    (doc.questions?.length ?? 0) > 0 ||
    (doc.evidence?.length ?? 0) > 0 ||
    (doc.flashcards?.length ?? 0) > 0 ||
    (doc.mistakes?.length ?? 0) > 0 ||
    (doc.readingProgress?.length ?? 0) > 0 ||
    (doc.chatThreads?.length ?? 0) > 0 ||
    (doc.sectionMarkings?.length ?? 0) > 0
  );
}

/**
 * The whole-document import payload (AD-4 verbatim, AD-12 client uuids).
 * Only the plan's aggregate arrays are stripped — the server realizes
 * nodeIds/materialIds from the rows' links; everything else rides as-is.
 */
export function toImportDocumentInput(doc: LegacyDocument): DocumentInput {
  return {
    version: doc.version,
    onboardingComplete: doc.onboardingComplete === true,
    plans: (doc.plans ?? []).map(({ id, topic, goal, createdAt }) => ({ id, topic, goal, createdAt })),
    nodes: doc.nodes ?? [],
    materials: doc.materials ?? [],
    tasks: doc.tasks ?? [],
    sessions: doc.sessions ?? [],
    questions: doc.questions ?? [],
    evidence: doc.evidence ?? [],
    flashcards: doc.flashcards ?? [],
    mistakes: doc.mistakes ?? [],
    readingProgress: doc.readingProgress ?? [],
    chatThreads: doc.chatThreads ?? [],
    sectionMarkings: doc.sectionMarkings ?? [],
  };
}

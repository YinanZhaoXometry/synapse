/**
 * Quiz session / evidence repository (AD-3): owns QuizSession, Question,
 * EvidenceRecord, MistakeEntry. recordEvidence is THE write path from finished
 * quiz answers to node-attributed evidence (AD-5/AD-6, ADR-0001) — atomic,
 * mistake-logging, and the only way scores ever move.
 */
import type { EvidenceRecord, MistakeEntry, Outcome, Question, QuizSession } from "@/domain/entities";
import { loadDb, saveDb, updateDb } from "./store";
import { AppError } from "./errors";

export interface QuestionInput {
  prompt: string;
  nodeId: string; // attribution at generation time (AD-6)
  kind: "open" | "choice";
  options?: string[];
  correctOptionIndex?: number;
  sourceMaterialId: string;
  sourceSectionId: string;
  keywords?: string[];
  explanation: string;
}

export interface AnswerResult {
  questionId: string;
  outcome: Outcome;
  userAnswer: string;
  forfeited: boolean;
}

export function createQuizSession(input: {
  planId: string | null;
  taskId: string | null;
  mode: "open" | "choice" | "mix";
  questions: QuestionInput[];
}): { session: QuizSession; questions: Question[] } {
  const db = loadDb();
  const now = new Date().toISOString();
  const session: QuizSession = {
    id: crypto.randomUUID(),
    planId: input.planId,
    taskId: input.taskId,
    mode: input.mode,
    questionIds: [],
    status: "active",
    createdAt: now,
    completedAt: null,
  };
  const questions: Question[] = input.questions.map((q) => ({
    ...q,
    id: crypto.randomUUID(),
    sessionId: session.id,
  }));
  session.questionIds = questions.map((q) => q.id);

  db.sessions.push(session);
  db.questions.push(...questions);
  saveDb(db);
  return { session, questions };
}

export function getQuizSession(id: string): QuizSession | undefined {
  return loadDb().sessions.find((s) => s.id === id);
}

/** The session's questions, in the session's own questionIds order (hydration). */
export function listQuestionsBySession(sessionId: string): Question[] {
  const session = loadDb().sessions.find((s) => s.id === sessionId);
  if (!session) return [];
  const byId = new Map(loadDb().questions.filter((q) => q.sessionId === sessionId).map((q) => [q.id, q]));
  return session.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
}

/**
 * Exit path (FR-18 story 15): marks an ACTIVE session abandoned, terminal and
 * not resumable. No evidence is written; already-completed sessions are never
 * demoted.
 */
export function abandonQuizSession(sessionId: string): void {
  updateDb((db) => {
    const session = db.sessions.find((s) => s.id === sessionId);
    if (session && session.status === "active") {
      session.status = "abandoned";
    }
  });
}

/** The locator a MistakeEntry carries (and the open-answer grader cites), resolved from the question's material source. */
export function questionSourceLocator(question: Question): MistakeEntry["sourceLocation"] {
  const material = loadDb().materials.find((m) => m.id === question.sourceMaterialId);
  if (material?.kind === "markdown") {
    return { kind: "markdown", sectionId: question.sourceSectionId };
  }
  // PDF section ids follow the parse convention `page-N` (entities.ts); the
  // page-1 fallback is unreachable for adapter-generated questions — a guard
  // for malformed data only, never a fabricated citation for real flows.
  const page = /^page-(\d+)$/.exec(question.sourceSectionId);
  return { kind: "pdf", page: page ? Number(page[1]) : 1 };
}

/**
 * Append one EvidenceRecord per answered question — validated first, applied
 * in a single synchronous write (whole batch or nothing). Wrong answers also
 * log MistakeEntries (FR-18: forfeit = wrong, logged, no credit).
 */
export function recordEvidence(input: {
  sessionId: string;
  results: AnswerResult[];
}): EvidenceRecord[] {
  const db = loadDb();

  // validate the whole batch before touching state (atomicity)
  const questionsById = new Map(db.questions.map((q) => [q.id, q]));
  for (const r of input.results) {
    if (!questionsById.has(r.questionId)) {
      throw new AppError("EVIDENCE_BATCH_UNKNOWN_QUESTION", "errors.evidenceBatchUnknown");
    }
  }

  const now = new Date().toISOString();
  const evidence: EvidenceRecord[] = [];
  const mistakes: MistakeEntry[] = [];
  for (const r of input.results) {
    const question = questionsById.get(r.questionId)!;
    evidence.push({
      id: crypto.randomUUID(),
      nodeId: question.nodeId,
      sessionId: input.sessionId,
      questionId: question.id,
      outcome: r.outcome,
      createdAt: now,
    });
    if (r.outcome === "wrong") {
      mistakes.push({
        id: crypto.randomUUID(),
        questionId: question.id,
        sessionId: input.sessionId,
        nodeId: question.nodeId,
        userAnswer: r.userAnswer,
        sourceLocation: questionSourceLocator(question),
        forfeited: r.forfeited,
        createdAt: now,
      });
    }
  }

  db.evidence.push(...evidence);
  db.mistakes.push(...mistakes);
  const session = db.sessions.find((s) => s.id === input.sessionId);
  if (session) {
    session.status = "completed";
    session.completedAt = now;
  }
  saveDb(db);
  return evidence;
}

export function listEvidenceByNode(nodeId: string): EvidenceRecord[] {
  return loadDb().evidence.filter((e) => e.nodeId === nodeId);
}

export function listEvidence(): EvidenceRecord[] {
  return loadDb().evidence;
}

/**
 * Server → view mappers (epic P2-8 T1): the one place generated GraphQL shapes
 * become the domain-entity views the features render. Unions are rebuilt from
 * the wire's strings here — deliberately the ONLY `as` casts in the swap; a
 * new server value lands as its honest union member or throws loud.
 */
import type {
  Annotation,
  ChatMessage,
  ChatThread,
  EvidenceRecord,
  Flashcard,
  KnowledgeNode,
  Material,
  MaterialSection,
  MistakeEntry,
  Question,
  QuizSession,
  ReadingLocator,
  ReadingPosition,
  ReadingProgress,
} from "@/domain/entities";
import { isValidAnnotationRange, type AnnotationRange } from "@/domain/annotation-range";
import type {
  AnnotationPartsFragment,
  ChatMessagePartsFragment,
  KnowledgeNodePartsFragment,
  MaterialNodeMappingPartsFragment,
  MaterialPartsFragment,
  NotePartsFragment,
  MaterialSummaryPartsFragment,
  StudyFocusSetPartsFragment,
  QuestionPartsFragment,
  QuizSessionPartsFragment,
  ReadingPositionPartsFragment,
  SectionMarkingPartsFragment,
} from "@/types/graphql";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView, NoteView, QuizSessionView, SectionMarkingView, StudyFocusSetView, StudyPlanView, StudyTaskView } from "./views";

function nodeState(state: string): KnowledgeNodeView["state"] {
  if (state === "uncovered" || state === "partial" || state === "mastered") return state;
  throw new Error(`unknown node state from the api: ${state}`);
}

function mappingStatus(status: string): MaterialNodeMappingView["status"] {
  if (status === "proposed" || status === "confirmed" || status === "rejected") return status;
  throw new Error(`unknown mapping status from the api: ${status}`);
}

export function mapMaterialNodeMapping(row: MaterialNodeMappingPartsFragment): MaterialNodeMappingView {
  return {
    id: row.id,
    materialId: row.materialId,
    nodeId: row.nodeId,
    sectionId: row.sectionId,
    proposedNodeTitle: row.proposedNodeTitle,
    status: mappingStatus(row.status),
    createdAt: row.createdAt,
  };
}

export function mapNode(node: KnowledgeNodePartsFragment): KnowledgeNodeView {
  return {
    id: node.id,
    planId: node.planId,
    taskId: node.taskId,
    stage: node.stage,
    title: node.title,
    // epic-16 (FR-5): the roadmap metadata rides verbatim — description nulls
    // on legacy nodes; optional is the server's Boolean! (default false).
    description: node.description ?? null,
    optional: node.optional === true,
    order: node.order,
    masteryScore: node.masteryScore,
    state: nodeState(node.state),
  };
}

function materialKind(kind: string): Material["kind"] {
  if (kind === "pdf" || kind === "markdown") return kind;
  throw new Error(`unknown material kind from the api: ${kind}`);
}

function parseState(state: string): Material["parseState"] {
  if (state === "pending" || state === "parsing" || state === "parsed" || state === "failed") return state;
  throw new Error(`unknown parse state from the api: ${state}`);
}

function parseFailureReason(reason: string | null): Material["parseFailureReason"] {
  if (reason === null) return undefined;
  if (reason === "corrupt" || reason === "encrypted" || reason === "empty" || reason === "unknown") return reason;
  throw new Error(`unknown parse failure reason from the api: ${reason}`);
}

// FR-44 (epic P2-10 T2): the api is the scope's one source — map it honestly,
// never guess a default (an unknown value is a contract break, not a "plan").
function attachmentScope(scope: string): Material["attachmentScope"] {
  if (scope === "plan" || scope === "node") return scope;
  throw new Error(`unknown attachment scope from the api: ${scope}`);
}

export function mapMaterialSummary(material: MaterialSummaryPartsFragment): MaterialView {
  return {
    id: material.id,
    title: material.title,
    kind: materialKind(material.kind),
    sizeBytes: material.sizeBytes,
    planId: material.planId,
    taskId: material.taskId,
    attachmentScope: attachmentScope(material.attachmentScope),
    nodeId: material.nodeId,
    parseState: parseState(material.parseState),
    parseFailureReason: parseFailureReason(material.parseFailureReason),
    sections: [], // summaries carry no sections — detail views use mapMaterial
    createdAt: material.createdAt,
    downloadUrl: material.downloadUrl,
  };
}

export function mapMaterial(material: MaterialPartsFragment): MaterialView {
  const sections: MaterialSection[] = material.sections.map((s) => ({ id: s.id, title: s.title, text: s.text }));
  return {
    id: material.id,
    title: material.title,
    kind: materialKind(material.kind),
    sizeBytes: material.sizeBytes,
    planId: material.planId,
    taskId: material.taskId,
    attachmentScope: attachmentScope(material.attachmentScope),
    nodeId: material.nodeId,
    parseState: parseState(material.parseState),
    parseFailureReason: parseFailureReason(material.parseFailureReason),
    sections,
    createdAt: material.createdAt,
    downloadUrl: material.downloadUrl,
  };
}

export function mapTask(task: { id: string; materialId: string; nodeId: string; createdAt: string; node: KnowledgeNodePartsFragment; promotedPlanId?: string | null; promotedAt?: string | null; promotedPlan?: { id: string; topic: string } | null }): StudyTaskView {
  return {
    id: task.id,
    materialId: task.materialId,
    nodeId: task.nodeId,
    createdAt: task.createdAt,
    node: mapNode(task.node),
    promotedPlanId: task.promotedPlanId ?? null,
    promotedAt: task.promotedAt ?? null,
    promotedPlan: task.promotedPlan ?? null,
  };
}

/** Wire locator → domain union (epic P2-8 T5: exported for the AI server
 * adapter's citation mapping — the one normalizer for both consumers). */
export function readingLocator(locator: ReadingPositionPartsFragment["locator"]): ReadingLocator {
  if (locator.kind === "pdf") {
    return { kind: "pdf", page: locator.page ?? 1 };
  }
  if (locator.kind === "markdown") {
    return { kind: "markdown", sectionId: locator.sectionId ?? "" };
  }
  throw new Error(`unknown locator kind from the api: ${locator.kind}`);
}

export function mapReadingPosition(position: ReadingPositionPartsFragment): ReadingPosition {
  return { locator: readingLocator(position.locator), text: position.text };
}

export function mapReadingProgress(progress: { id: string; materialId: string; updatedAt: string; position: ReadingPositionPartsFragment }): ReadingProgress {
  return {
    materialId: progress.materialId,
    position: { locator: readingLocator(progress.position.locator), text: progress.position.text },
    updatedAt: progress.updatedAt,
    ...({ id: progress.id } as object), // server row id — kept, harmless extra
  };
}

function chatRole(role: string): ChatMessage["role"] {
  if (role === "user" || role === "companion") return role;
  throw new Error(`unknown chat role from the api: ${role}`);
}

export function mapChatMessage(message: ChatMessagePartsFragment): ChatMessage {
  return {
    id: message.id,
    role: chatRole(message.role),
    text: message.text,
    citations: message.citations.map(readingLocator),
    createdAt: message.createdAt,
  };
}

export function mapChatThread(thread: { id: string; materialId: string | null; planId: string | null; updatedAt: string; messages: ChatMessagePartsFragment[] }): ChatThread {
  return {
    materialId: thread.materialId,
    planId: thread.planId,
    messages: thread.messages.map(mapChatMessage),
    updatedAt: thread.updatedAt,
    ...({ id: thread.id } as object),
  };
}

function outcome(outcome: string): EvidenceRecord["outcome"] {
  if (outcome === "correct" || outcome === "partial" || outcome === "wrong") return outcome;
  throw new Error(`unknown outcome from the api: ${outcome}`);
}

export function mapEvidence(record: { id: string; nodeId: string; sessionId: string | null; questionId: string | null; outcome: string; createdAt: string }): EvidenceRecord {
  return {
    id: record.id,
    nodeId: record.nodeId,
    sessionId: record.sessionId,
    questionId: record.questionId,
    outcome: outcome(record.outcome),
    createdAt: record.createdAt,
  };
}

function questionKind(kind: string): Question["kind"] {
  if (kind === "open" || kind === "choice") return kind;
  throw new Error(`unknown question kind from the api: ${kind}`);
}

export function mapQuestion(question: QuestionPartsFragment): Question {
  return {
    id: question.id,
    sessionId: question.sessionId,
    nodeId: question.nodeId,
    kind: questionKind(question.kind),
    prompt: question.prompt,
    options: question.options ?? undefined,
    correctOptionIndex: question.correctOptionIndex ?? undefined,
    sourceMaterialId: question.sourceMaterialId,
    sourceSectionId: question.sourceSectionId,
    keywords: question.keywords ?? undefined,
    explanation: question.explanation,
  };
}

function sessionMode(mode: string): QuizSession["mode"] {
  if (mode === "open" || mode === "choice" || mode === "mix") return mode;
  throw new Error(`unknown session mode from the api: ${mode}`);
}

function sessionStatus(status: string): QuizSession["status"] {
  if (status === "active" || status === "completed" || status === "abandoned") return status;
  throw new Error(`unknown session status from the api: ${status}`);
}

export function mapQuizSession(session: QuizSessionPartsFragment): QuizSessionView {
  return {
    id: session.id,
    planId: session.planId,
    taskId: session.taskId,
    mode: sessionMode(session.mode),
    questionIds: session.questions.map((q) => q.id),
    status: sessionStatus(session.status),
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    questions: session.questions.map(mapQuestion),
  };
}

function difficulty(value: string | null): Flashcard["difficulty"] {
  if (value === null) return null;
  if (value === "hard" || value === "medium" || value === "easy") return value;
  throw new Error(`unknown flashcard difficulty from the api: ${value}`);
}

export function mapFlashcard(card: { id: string; materialId: string; nodeId: string | null; front: string; back: string; difficulty: string | null; createdAt: string }): Flashcard {
  return {
    id: card.id,
    materialId: card.materialId,
    nodeId: card.nodeId,
    front: card.front,
    back: card.back,
    difficulty: difficulty(card.difficulty),
    createdAt: card.createdAt,
  };
}

export function mapMistake(mistake: {
  id: string;
  questionId: string;
  sessionId: string | null;
  nodeId: string;
  userAnswer: string;
  sourceLocation: ReadingPositionPartsFragment["locator"];
  forfeited: boolean;
  createdAt: string;
}): MistakeEntry {
  return {
    id: mistake.id,
    questionId: mistake.questionId,
    sessionId: mistake.sessionId,
    nodeId: mistake.nodeId,
    userAnswer: mistake.userAnswer,
    sourceLocation: readingLocator(mistake.sourceLocation),
    forfeited: mistake.forfeited,
    createdAt: mistake.createdAt,
  };
}

function noteScope(scope: string): NoteView["scope"] {
  if (scope === "plan" || scope === "node" || scope === "material") return scope;
  throw new Error(`unknown note scope from the api: ${scope}`);
}

export function mapNote(note: NotePartsFragment): NoteView {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    scope: noteScope(note.scope),
    scopeId: note.scopeId,
    enrichment: note.enrichment,
    targeting: note.targeting,
    createdAt: note.createdAt,
  };
}

// ── Annotations (FR-16, epic-13 T3) ──────────────────────────────────────

function annotationKind(kind: string): Annotation["kind"] {
  if (kind === "highlight" || kind === "underline") return kind;
  throw new Error(`unknown annotation kind from the api: ${kind}`);
}

/** The wire range (nullable address halves) → the strict AD-2 domain range
 * (sectionId XOR page). An invalid row throws loud — the honest-mapper law
 * (never a silently misplaced annotation). */
function annotationRange(range: AnnotationPartsFragment["range"]): AnnotationRange {
  const out: AnnotationRange = { start: range.start, end: range.end, quote: range.quote };
  if (range.sectionId != null) out.sectionId = range.sectionId;
  if (range.page != null) out.page = range.page;
  if (!isValidAnnotationRange(out)) {
    throw new Error(`invalid annotation range from the api: ${JSON.stringify(range)}`);
  }
  return out;
}

export function mapAnnotation(row: AnnotationPartsFragment): Annotation {
  return {
    id: row.id,
    materialId: row.materialId,
    locator: readingLocator(row.locator),
    range: annotationRange(row.range),
    kind: annotationKind(row.kind),
    color: row.color,
    body: row.body,
    createdAt: row.createdAt,
  };
}

// ── Study Focus (FR-17, epic-13 T4) ──────────────────────────────────────

/** The wire item's sourceRange (JSON scalar) → the strict AD-2 domain
 * range. Null rides through (a range-less pre-T3 import source — the item
 * is honestly unlinkable); a NON-null shape that fails the server command
 * law throws loud — the honest-mapper law (never a silently misplaced
 * deep link). */
function focusSourceRange(sourceRange: unknown): AnnotationRange | null {
  if (sourceRange == null) return null;
  if (typeof sourceRange !== "object") {
    throw new Error(`invalid study focus sourceRange from the api: ${JSON.stringify(sourceRange)}`);
  }
  const raw = sourceRange as Partial<AnnotationRange>;
  const out: AnnotationRange = {
    start: raw.start as number,
    end: raw.end as number,
    quote: raw.quote as string,
  };
  if (raw.sectionId != null) out.sectionId = raw.sectionId;
  if (raw.page != null) out.page = raw.page;
  if (!isValidAnnotationRange(out)) {
    throw new Error(`invalid study focus sourceRange from the api: ${JSON.stringify(sourceRange)}`);
  }
  return out;
}

export function mapStudyFocusSet(set: StudyFocusSetPartsFragment): StudyFocusSetView {
  return {
    id: set.id,
    materialId: set.materialId,
    generation: set.generation,
    items: set.items.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      sourceRange: focusSourceRange(item.sourceRange),
    })),
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
  };
}

// ── Mastery Marking claims (FR-15, epic-15 T2) ───────────────────────────

/** Wire claim row → the domain claim. DateTimes ride as plain strings per the
 * codegen scalar config — never re-formatted; `clearedAt` stays exactly null
 * while the claim is open (the open-claim derivation is the consumer's
 * `clearedAt == null` — rows are history, so a null never becomes a default).
 * Rows arrive newest-first from the server; a pure per-row map keeps that
 * order (no client re-sort anywhere in the seam). */
export function mapSectionMarking(row: SectionMarkingPartsFragment): SectionMarkingView {
  return {
    id: row.id,
    materialId: row.materialId,
    sectionId: row.sectionId,
    claimedAt: row.claimedAt,
    clearedAt: row.clearedAt ?? null,
  };
}

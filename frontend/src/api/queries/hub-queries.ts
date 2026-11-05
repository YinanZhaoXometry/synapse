/**
 * Hub read-model hooks (epic P2-09 T2): the web's typed consumption of T1's
 * api-side aggregation (backend Hubs module). `mistakesHub` is the FLAT
 * newest-first list — grouping, filtering, and label resolution off the ids
 * the wire carries are the consuming page's rendering concerns; these hooks
 * only map the wire honestly (AD-12 plain lists, AD-14 render-never-recompute).
 *
 * Convention (every hook in src/api/queries):
 *   queries  → { data (mapped view | undefined), loading, error, refetch }
 */
import { useQuery } from "@apollo/client/react";
import { MistakesHubDocument } from "@/types/graphql";
import { readingLocator } from "../mappers";
import type { ReadingLocator } from "@/domain/entities";

/** The mistaken question's hub-readable half (FR-23): the prompt plus what
 * the answer rendering needs — the kind and, for Choice, the option texts. */
export interface HubMistakeQuestionView {
  prompt: string;
  /** "open" or "choice" (Quiz = Open + Choice, and Mix over both). */
  kind: "open" | "choice";
  /** The choice options (choice questions only). */
  options: string[] | undefined;
}

/** One wrong answer on the mistakes hub (FR-23): the user's answer, the
 * node/plan/task context (ids — the page resolves display titles through its
 * own list reads), and the source material + verbatim locator for the AD-8
 * deep link. */
export interface HubMistakeEntryView {
  id: string;
  questionId: string;
  sessionId: string | null;
  /** The attributed node's uuid (follows the question's attribution, AD-6). */
  nodeId: string;
  /** The plan the node belongs to (null on task-owned nodes). */
  planId: string | null;
  /** The task the node belongs to (null on plan nodes). */
  taskId: string | null;
  /** The question's source material — the deep-link target (FR-23). */
  materialId: string;
  /** What the user answered (empty on a forfeit). */
  userAnswer: string;
  sourceLocation: ReadingLocator;
  /** 「看答案 = 放弃」: graded wrong, no mastery credit (FR-18). */
  forfeited: boolean;
  createdAt: string;
  question: HubMistakeQuestionView;
}

// The mappers' union-rebuild convention: an unknown wire value is a contract
// break, not a guess (mappers.ts is the reference; this op selects a partial
// question, so the kind half rides here).
function questionKind(kind: string): "open" | "choice" {
  if (kind === "open" || kind === "choice") return kind;
  throw new Error(`unknown question kind from the api: ${kind}`);
}

export function useMistakesHubQuery() {
  const result = useQuery(MistakesHubDocument);
  const rows: HubMistakeEntryView[] = (result.data?.mistakesHub ?? []).map((row) => ({
    id: row.id,
    questionId: row.questionId,
    sessionId: row.sessionId,
    nodeId: row.nodeId,
    planId: row.planId,
    taskId: row.taskId,
    materialId: row.materialId,
    userAnswer: row.userAnswer,
    sourceLocation: readingLocator(row.sourceLocation),
    forfeited: row.forfeited,
    createdAt: row.createdAt,
    question: {
      prompt: row.question.prompt,
      kind: questionKind(row.question.kind),
      options: row.question.options ?? undefined,
    },
  }));
  return { data: result.data !== undefined ? rows : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/**
 * The entry's human answer text (FR-23): Choice renders the chosen OPTION's
 * text — the quiz runner stores the option string itself as userAnswer
 * (session-machine resolves the picked index through options), so the stored
 * text IS the resolution when it matches an option. Anything else (a drifted
 * option set, legacy rows) renders the stored answer verbatim — never guessed.
 * Open rides verbatim ("" on a forfeit — the page renders the forfeit label).
 */
export function resolveMistakeAnswer(entry: HubMistakeEntryView): string {
  const choiceOption =
    entry.question.kind === "choice"
      ? entry.question.options?.find((option) => option === entry.userAnswer)
      : undefined;
  return choiceOption ?? entry.userAnswer;
}

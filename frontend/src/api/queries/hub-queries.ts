/**
 * Hub read-model hooks (epic P2-09 T2): the web's typed consumption of T1's
 * api-side aggregation (backend Hubs module). `mistakesHub` is the FLAT
 * newest-first list — grouping, filtering, and label resolution off the ids
 * the wire carries are the consuming page's rendering concerns; these hooks
 * only map the wire honestly (AD-12 plain lists, AD-14 render-never-recompute).
 * T3 adds todayHub (FR-27's 今日学习 assembly) + its manual-task ops (the
 * writes T1 deferred), and the consistency read the week strip maps onto the
 * current week.
 *
 * Convention (every hook in src/api/queries):
 *   queries  → { data (mapped view | undefined), loading, error, refetch }
 *   mutations → raw Apollo [mutate, result] tuples; refetch sweeps are declared
 *               on the hook, call sites pass { variables: { input }, onCompleted, onError }
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AddManualTaskDocument,
  DeleteManualTaskDocument,
  MistakesHubDocument,
  SetManualTaskDoneDocument,
  TodayConsistencyDocument,
  TodayHubDocument,
} from "@/types/graphql";
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

// ── todayHub (epic P2-09 T3, FR-27) ────────────────────────────────────────

/** The schedulable kinds the re-queue surfaces (DueItemType's wire
 * discriminator — an unknown value is a contract break, not a guess). */
export type DueItemKind = "mistake" | "flashcard";

/** One due review on the 今日学习 list: what the row renders (the question
 * prompt / the card front), its schedule facts (dueAt, stage), and the
 * node/plan/task/material ids the page builds the study-flow deep link from.
 * questionId + sourceLocation ride for mistakes only (null on flashcards —
 * the type guard is the api's, the null is honest here). */
export interface HubDueItemView {
  kind: DueItemKind;
  itemId: string;
  dueAt: string;
  /** The re-queue ladder stage (flashcards stay 0 — the rating reschedules). */
  stage: number;
  title: string;
  nodeId: string | null;
  planId: string | null;
  taskId: string | null;
  materialId: string | null;
  questionId: string | null;
  sourceLocation: ReadingLocator | null;
}

/** One per-weak-plan suggestion card (delta decision 2, v1 partial): the
 * plan + its weakest node by server score — the page deep-links the
 * 节点快测 (nodeQuickTestHref) and carries the partial-v1 flag. */
export interface HubSuggestionView {
  planId: string;
  planTitle: string;
  nodeId: string;
  nodeTitle: string;
}

/** The user's own manual task (the add/toggle/delete ops' row). */
export interface HubManualTaskView {
  id: string;
  title: string;
  /** The target day (ISO midnight) or null — the unscheduled task. */
  dueDate: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The day's counts, server-computed (doneCount is all-time — ManualTask
 * carries no done-at timestamp; the page labels it honestly). */
export interface HubTodaySummaryView {
  dueCount: number;
  manualCount: number;
  doneCount: number;
}

export interface HubTodayView {
  due: HubDueItemView[];
  suggestions: HubSuggestionView[];
  manual: HubManualTaskView[];
  summary: HubTodaySummaryView;
}

// The mappers' union-rebuild convention: an unknown wire value is a contract
// break, not a guess (mappers.ts is the reference).
function dueItemKind(itemType: string): DueItemKind {
  if (itemType === "mistake" || itemType === "flashcard") return itemType;
  throw new Error(`unknown due-item type from the api: ${itemType}`);
}

export function useTodayHubQuery() {
  const result = useQuery(TodayHubDocument);
  const due: HubDueItemView[] = (result.data?.todayHub.due ?? []).map((row) => ({
    kind: dueItemKind(row.itemType),
    itemId: row.itemId,
    dueAt: row.dueAt,
    stage: row.stage,
    title: row.title,
    nodeId: row.nodeId,
    planId: row.planId,
    taskId: row.taskId,
    materialId: row.materialId,
    questionId: row.questionId,
    sourceLocation: row.sourceLocation ? readingLocator(row.sourceLocation) : null,
  }));
  const view: HubTodayView = {
    due,
    suggestions: result.data?.todayHub.suggestions ?? [],
    manual: result.data?.todayHub.manual ?? [],
    summary: result.data?.todayHub.summary ?? { dueCount: 0, manualCount: 0, doneCount: 0 },
  };
  return { data: result.data !== undefined ? view : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** One consistency day (the week strip's source): the UTC day key plus the
 * distinct evidence-producing session count (SM-C3). */
export interface ConsistencyDayView {
  day: string;
  sessionCount: number;
}

export function useTodayConsistencyQuery() {
  const result = useQuery(TodayConsistencyDocument);
  const days: ConsistencyDayView[] = (result.data?.analyticsSeries.consistency ?? []).map((row) => ({
    day: row.day,
    sessionCount: row.sessionCount,
  }));
  return { data: result.data !== undefined ? days : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

// ── The manual-task ops (the writes T1 deferred) ───────────────────────────
// The row returns, but todayHub's manual list + summary counts are the read
// the page renders — every op sweeps the hub read (the list read-back).

export function useAddManualTaskMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(AddManualTaskDocument, {
    refetchQueries: [TodayHubDocument],
    onError: () => {
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

export function useSetManualTaskDoneMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(SetManualTaskDoneDocument, {
    refetchQueries: [TodayHubDocument],
    onError: () => {
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

export function useDeleteManualTaskMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(DeleteManualTaskDocument, {
    refetchQueries: [TodayHubDocument],
    onError: () => {
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

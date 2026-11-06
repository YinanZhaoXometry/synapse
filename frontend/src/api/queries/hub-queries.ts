/**
 * Hub read-model hooks (epic P2-09 T2): the web's typed consumption of T1's
 * api-side aggregation (backend Hubs module). `mistakesHub` is the FLAT
 * newest-first list — grouping, filtering, and label resolution off the ids
 * the wire carries are the consuming page's rendering concerns; these hooks
 * only map the wire honestly (AD-12 plain lists, AD-14 render-never-recompute).
 * T3 adds todayHub (FR-27's 今日学习 assembly) + its manual-task ops (the
 * writes T1 deferred), and the consistency read the week strip maps onto the
 * current week. T4 adds flashcardDecksHub + quizHistoryHub (FR-41/42) and the
 * one schema movement — retakeQuizSession, the hub retake (a fresh server-side
 * generation; each call mints a new attempt). T5 adds analyticsSeries +
 * weeklyGoal + setWeeklyGoal (FR-26/25: the three series, the weekly-goal read
 * + its plain setter) and badgeState (the dashboard's recent-unlocked slice;
 * the full page is T6's).
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
  BadgeStatesDocument,
  AnalyticsSeriesDocument,
  DeleteManualTaskDocument,
  FlashcardDecksHubDocument,
  GenerateTodaySuggestionDocument,
  MistakesHubDocument,
  QuizHistoryHubDocument,
  RetakeQuizSessionDocument,
  SetManualTaskDoneDocument,
  SetMistakeEntryResolvedDocument,
  SetWeeklyGoalDocument,
  TodayConsistencyDocument,
  TodayHubDocument,
  WeeklyGoalDocument,
} from "@/types/graphql";
import { apiErrorCode } from "../errors";
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
  /** The user-marked lifecycle state (epic-18 T1, spec decision 4) — the
   * page toggles it both ways through setMistakeEntryResolved; display/
   * lifecycle only, never a Mastery input (AD-6/ADR-0001). */
  resolved: boolean;
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
    resolved: row.resolved,
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

// ── the mistake lifecycle (epic-18 T4, spec decision 4) ────────────────────
// The setter toggles BOTH ways (user-marked, no auto-resolve). Read-back-is-
// truth (the scope-mutation posture): the payload echoes the toggled entry,
// but the page renders the hub read — the sweep re-reads mistakesHub so the
// card re-renders on server truth. Failures toast per code at the hook (the
// Planner generate path's mapping posture, epic-18 T6 review): NOT_FOUND is
// its own honest key (the entry is gone), every other code — and null-code
// transport/parse failures — stay on the generic persist-failed key.

// The per-code toast map (AD-9's one place, apiErrorKeys' mapping pattern):
// only NOT_FOUND reads differently for a resolve toggle; the rest of the
// closed enum collapses onto the persist-failed key.
const RESOLVE_ERROR_KEYS: Record<string, string> = { NOT_FOUND: "mistakes.resolveNotFound" };

export function useSetMistakeEntryResolvedMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(SetMistakeEntryResolvedDocument, {
    refetchQueries: [MistakesHubDocument],
    onError: (error) => {
      const code = apiErrorCode(error);
      toast.error(t((code && RESOLVE_ERROR_KEYS[code]) || "errors.persistFailed"));
    },
  });
  return { mutate, result };
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

// ── the on-demand AI suggestion (epic-18 T2/T4, spec decisions 7–10) ───────
// generateTodaySuggestion is the Today hub's generation-backed ADDITION to
// the v1 heuristic slot: ONE cap-counted provider call server-side,
// replay-before-spend on the client-derived deterministic key (uuid5 over
// the user-scoped namespace + planId + UTC day — src/lib/uuid5.ts mirrors
// Ai::TodaySuggestionKey). Explicit-generate only: the button is the ONLY
// trigger — nothing fires on hub load. No refetch sweep: the reply is the
// payload (the v1 todayHub read is untouched by the generation), and the
// caller maps the error codes (CAP_REACHED needs its own honest state).

/** One generation-backed Today suggestion (the mutation's reply): the
 * server-chosen node + the reason line (the model never owns the name — the
 * title resolves through the persisted node server-side) + the suggestion's
 * UTC day key (the replay key's day half). */
export interface AiTodaySuggestionView {
  planId: string;
  /** The suggested node's uuid (the deep link's nodeId). */
  nodeId: string;
  nodeTitle: string;
  reason: string;
  /** "YYYY-MM-DD" UTC — the day the key was derived for. */
  day: string;
}

/** Wire → view (the mappers' verbatim convention — the reply has no closed
 * enums, every field rides as-is). */
export function mapAiTodaySuggestion(row: {
  planId: string;
  nodeId: string;
  nodeTitle: string;
  reason: string;
  day: string;
}): AiTodaySuggestionView {
  return { planId: row.planId, nodeId: row.nodeId, nodeTitle: row.nodeTitle, reason: row.reason, day: row.day };
}

export function useGenerateTodaySuggestionMutation() {
  const [mutate, result] = useMutation(GenerateTodaySuggestionDocument);
  return { mutate, result };
}

// ── flashcardDecksHub + quizHistoryHub + retake (epic P2-09 T4, FR-41/42) ──

/** One deck on the flashcards hub (FR-41): the material's title, its plan/task
 * origin (exactly one in healthy data — the attach contract; both null → the
 * row renders without a study action), the card count, and the deck's
 * creation moment (the MATERIAL's timestamp — the server's decision). */
export interface HubDeckView {
  materialId: string;
  materialTitle: string;
  planId: string | null;
  planTitle: string | null;
  taskId: string | null;
  cardCount: number;
  createdAt: string;
}

export function useFlashcardDecksHubQuery() {
  const result = useQuery(FlashcardDecksHubDocument);
  const rows: HubDeckView[] = (result.data?.flashcardDecksHub ?? []).map((row) => ({
    materialId: row.materialId,
    materialTitle: row.materialTitle,
    planId: row.planId,
    planTitle: row.planTitle,
    taskId: row.taskId,
    cardCount: row.cardCount,
    createdAt: row.createdAt,
  }));
  return { data: result.data !== undefined ? rows : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** One session on the quiz history hub (FR-42): the origin ids (the plan
 * title rides the wire; the task title resolves off the tasks list read on
 * the page — the mistakes-hub convention), the mode, and the GRADED-answers
 * score summary. A zero total is the honest 未完成 row: evidence lands only
 * at completion, so zero graded answers = active or abandoned. */
export interface HubQuizHistoryView {
  sessionId: string;
  planId: string | null;
  planTitle: string | null;
  taskId: string | null;
  mode: "open" | "choice" | "mix";
  createdAt: string;
  questionCount: number;
  scoreSummary: { correct: number; total: number };
}

// The mappers' union-rebuild convention: an unknown wire value is a contract
// break, not a guess (mappers.ts is the reference).
function quizMode(mode: string): "open" | "choice" | "mix" {
  if (mode === "open" || mode === "choice" || mode === "mix") return mode;
  throw new Error(`unknown quiz mode from the api: ${mode}`);
}

export function useQuizHistoryHubQuery() {
  const result = useQuery(QuizHistoryHubDocument);
  const rows: HubQuizHistoryView[] = (result.data?.quizHistoryHub ?? []).map((row) => ({
    sessionId: row.sessionId,
    planId: row.planId,
    planTitle: row.planTitle,
    taskId: row.taskId,
    mode: quizMode(row.mode),
    createdAt: row.createdAt,
    questionCount: row.questionCount,
    scoreSummary: { correct: row.scoreSummary.correct, total: row.scoreSummary.total },
  }));
  return { data: result.data !== undefined ? rows : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** The hub retake (FR-42): a NEW server-generated session seeded from the old
 * one's scope + mode — each call mints a fresh attempt (deliberately NOT
 * idempotent; the api description says so). The sweep re-reads the history so
 * the new session appears alongside the old. */
export function useRetakeQuizSessionMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(RetakeQuizSessionDocument, {
    refetchQueries: [QuizHistoryHubDocument],
    onError: () => {
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

// ── analyticsSeries + weeklyGoal + badgeState (epic P2-09 T5, FR-26/25) ─────

/** Mastery's node-state vocabulary verbatim (AD-6) — structurally the shared
 * display contract's state type (node-state.ts renders it). */
export type HubNodeState = "uncovered" | "partial" | "mastered";

/** One node's mastery row on the analytics series (FR-26): the SERVER score
 * as the string-carrying-percent convention and the SERVER state — rendering
 * reads them, never recomputes (AD-14). */
export interface HubNodeMasteryView {
  nodeId: string;
  nodeTitle: string;
  /** The owning plan's uuid (null on task-owned nodes). */
  planId: string | null;
  /** "0".."100" — the Mastery Score string, rendered verbatim. */
  masteryScore: string;
  state: HubNodeState;
}

/** One ISO week's accuracy point (FR-26): graded answers bucketed by the
 * week's Monday-UTC; the accuracy ratio is the page's rendering math. */
export interface HubWeeklyAccuracyView {
  /** The ISO Monday as a UTC day key ("YYYY-MM-DD"). */
  weekStart: string;
  correct: number;
  answered: number;
}

export interface HubAnalyticsSeriesView {
  nodeMastery: HubNodeMasteryView[];
  weeklyAccuracy: HubWeeklyAccuracyView[];
  consistency: ConsistencyDayView[];
}

// The mappers' union-rebuild convention: an unknown wire value is a contract
// break, not a guess (mappers.ts is the reference).
function nodeState(state: string): HubNodeState {
  if (state === "uncovered" || state === "partial" || state === "mastered") return state;
  throw new Error(`unknown node state from the api: ${state}`);
}

export function useAnalyticsSeriesQuery() {
  const result = useQuery(AnalyticsSeriesDocument);
  const series: HubAnalyticsSeriesView = {
    nodeMastery: (result.data?.analyticsSeries.nodeMastery ?? []).map((row) => ({
      nodeId: row.nodeId,
      nodeTitle: row.nodeTitle,
      planId: row.planId,
      masteryScore: row.masteryScore,
      state: nodeState(row.state),
    })),
    weeklyAccuracy: (result.data?.analyticsSeries.weeklyAccuracy ?? []).map((row) => ({
      weekStart: row.weekStart,
      correct: row.correct,
      answered: row.answered,
    })),
    consistency: (result.data?.analyticsSeries.consistency ?? []).map((row) => ({
      day: row.day,
      sessionCount: row.sessionCount,
    })),
  };
  return { data: result.data !== undefined ? series : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** The weekly goal (FR-25, delta decision 3): the user's sessions/week target
 * against DISTINCT evidence-producing sessions in the current ISO week
 * (Mon-UTC) — the dashboard ring's honest source (SM-C3: never minutes). */
export interface HubWeeklyGoalView {
  /** Sessions/week; 1..21 (server-validated). */
  target: number;
  currentWeekSessions: number;
  /** The current ISO week's Monday as a UTC day key. */
  currentWeekStart: string;
}

export function useWeeklyGoalQuery() {
  const result = useQuery(WeeklyGoalDocument);
  const goal: HubWeeklyGoalView | undefined = result.data?.weeklyGoal
    ? {
        target: result.data.weeklyGoal.target,
        currentWeekSessions: result.data.weeklyGoal.currentWeekSessions,
        currentWeekStart: result.data.weeklyGoal.currentWeekStart,
      }
    : undefined;
  return { data: result.data !== undefined ? goal : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** The plain setter (last write wins; 1..21 server-validated, the same range
 * the DB check pins). The payload echoes the fresh weeklyGoal read — the
 * normalized cache write-through updates the ring; no refetch needed. */
export function useSetWeeklyGoalMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(SetWeeklyGoalDocument, {
    onError: () => {
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

/** One badge's raw state (FR-28, delta decision 1) — the scaffold taxonomy's
 * ids ("b1".."b12") with the server counter/threshold/unlocked. The zh/en
 * name strings live in the i18n dictionary (ach.b*); the full page is T6's,
 * the dashboard renders the recent-unlocked summary. */
export interface HubBadgeStateView {
  id: string;
  unlocked: boolean;
  counter: number;
  threshold: number;
}

export function useBadgeStatesQuery() {
  const result = useQuery(BadgeStatesDocument);
  const rows: HubBadgeStateView[] = (result.data?.badgeState ?? []).map((row) => ({
    id: row.id,
    unlocked: row.unlocked,
    counter: row.counter,
    threshold: row.threshold,
  }));
  return { data: result.data !== undefined ? rows : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

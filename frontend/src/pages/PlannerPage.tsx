/**
 * The 今日学习 hub (FR-27, epic P2-09 T3): /planner re-points from the demo
 * planner onto the todayHub read model (T1's api assembly) — the day's due
 * re-queue reviews, the user's own manual tasks (add / complete toggle /
 * delete through the ops T1 deferred), the per-weak-plan quick-test
 * suggestion slot (delta decision 2's v1 partial posture — the flag chip
 * 「按掌握度推荐 · v1」 rides every card), the server day counts, and a light
 * week strip mapped from analyticsSeries.consistency (the read model has no
 * per-day evidence calendar — the 14-day consistency series is the honest
 * source; days outside it render as no-data).
 *
 * Deep links are per schedulable kind and launch the flow that completes the
 * item (there is no inline "mark review done" — completion IS the fresh
 * evidence the flow produces): a due mistake re-quizzes its node
 * (/task/:id/quiz on task context, nodeQuickTestHref on plan context, the
 * mistakes hub as the anchor fallback), a due flashcard opens its deck flow
 * (/task/:id/flashcards, /plan/:id/flashcards, the flashcards hub as the
 * fallback). The label rule holds: zh 今日学习; 学习计划 stays reserved for
 * Study Plans. The demo fixtures (DEFAULT_TASKS + the planner.task* keys)
 * retired with this re-point — the empty state is honest.
 *
 * The AI suggestion (epic-18 T4, spec decisions 7–10): a per-plan generation-
 * backed card under the v1 slot — the ADDITION, never a replacement. The
 * 「生成 AI 建议」 button is the ONLY trigger (no provider call on hub load);
 * the mutation rides the DETERMINISTIC per-(user, plan, UTC day) client uuid
 * (src/lib/uuid5.ts mirrors Ai::TodaySuggestionKey) so the server replays a
 * same-day regeneration for free (replay-before-spend), CAP_REACHED lands as
 * an honest disabled cap note, any other failure toasts the closed-enum key,
 * and the v1 card above stays byte-identical either way.
 */
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, Check, Flame, Layers, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { authedUserUuid } from "@/apollo";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiErrorCode,
  apiErrorKeys,
  mapAiTodaySuggestion,
  useAddManualTaskMutation,
  useDeleteManualTaskMutation,
  useGenerateTodaySuggestionMutation,
  useSetManualTaskDoneMutation,
  useStreakQuery,
  useTodayConsistencyQuery,
  useTodayHubQuery,
  type AiTodaySuggestionView,
  type HubDueItemView,
  type HubManualTaskView,
} from "@/api";
import { todayWeekStrip, utcDayKey, type WeekStripCell } from "@/domain/today-week";
import { nodeQuickTestHref } from "@/features/plans";
import { todaySuggestionClientUuid } from "@/lib/uuid5";
import { cn } from "@/lib/utils";

// The closed-enum → t()-key map for the generation failures (AD-9's one
// place; the ai.generate.* keys already carry the honest copy for every
// code). null-code errors (transport/parse) land on the generic failure key.
const AI_GENERATION_KEYS: Record<string, string> = apiErrorKeys("ai.generate.");
const AI_GENERATION_FAILED_KEY = "ai.generate.failed";

/** The study-flow deep link for one due review, per its schedulable kind.
 * Each target launches the flow that produces the item's completing
 * evidence (the re-queue's own semantics — mistakes advance on correct
 * re-answers, flashcards reschedule on their rating). An unknown kind is a
 * contract break (the hook validates the wire, this guards the seam). */
export function dueItemHref(item: HubDueItemView): string {
  if (item.kind === "mistake") {
    if (item.taskId) return `/task/${encodeURIComponent(item.taskId)}/quiz`;
    if (item.planId && item.nodeId) return nodeQuickTestHref(item.planId, item.nodeId);
    return "/mistakes"; // the unlinked entry's home — the honest anchor fallback
  }
  if (item.kind === "flashcard") {
    if (item.taskId) return `/task/${encodeURIComponent(item.taskId)}/flashcards`;
    if (item.planId) return `/plan/${encodeURIComponent(item.planId)}/flashcards`;
    return "/flashcards"; // the deck-less card's hub fallback
  }
  throw new Error(`unknown due-item kind: ${item.kind}`);
}

const CELL_STATE_CLS: Record<WeekStripCell["state"], string> = {
  evidence: "bg-gradient-to-r from-grad-a to-grad-b border-transparent",
  quiet: "bg-[hsl(var(--uncovered-fill))] border-border",
  unknown: "bg-transparent border-border border-dashed",
};

/** One due-review row: the type chip, the render title (prompt / front), the
 * ladder stage (mistakes only — flashcards read 0 by design), and the
 * study-flow launch. No inline toggle: completing a review happens in the
 * flow (fresh evidence), never as a separate flag. */
function DueItemRow({ item }: { item: HubDueItemView }) {
  const { t } = useLanguage();
  const mistake = item.kind === "mistake";
  return (
    <div className="flex items-start gap-3 py-3.5 px-1 border-b border-border-soft last:border-b-0">
      <span
        className={cn(
          "pill flex-none",
          mistake ? "bg-[rgba(168,50,50,0.1)] text-danger-ink" : "bg-[hsl(var(--mastered-tint))] text-mastered-ink",
        )}
      >
        {mistake ? <BookOpen className="w-3 h-3" aria-hidden="true" /> : <Layers className="w-3 h-3" aria-hidden="true" />}
        {t(mistake ? "planner.dueKindMistake" : "planner.dueKindFlashcard")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-[1.45] line-clamp-2">{item.title}</div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          {mistake && item.stage > 0 && (
            <span className="pill pill-muted">{t("planner.dueStage", { n: item.stage })}</span>
          )}
        </div>
      </div>
      <Link
        to={dueItemHref(item)}
        className="ml-auto flex-none inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t(mistake ? "planner.dueCtaMistakeAria" : "planner.dueCtaFlashcardAria", { title: item.title })}
      >
        {mistake ? <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> : <Layers className="w-3.5 h-3.5" aria-hidden="true" />}
        {t(mistake ? "planner.dueCtaMistake" : "planner.dueCtaFlashcard")}
      </Link>
    </div>
  );
}

/** One suggestion card (delta decision 2, v1 partial): plan + weakest node +
 * the 节点快测 deep link, with the partial flag chip. */
function SuggestionCard({ suggestion }: { suggestion: { planId: string; planTitle: string; nodeId: string; nodeTitle: string } }) {
  const { t } = useLanguage();
  return (
    <article className="bg-card border border-border-soft rounded-2xl p-4 shadow-raised flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-snug truncate">{suggestion.planTitle}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{suggestion.nodeTitle}</div>
      </div>
      <span className="pill pill-muted flex-none">{t("planner.suggestionFlag")}</span>
      <Link
        to={nodeQuickTestHref(suggestion.planId, suggestion.nodeId)}
        className="flex-none inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero text-white shadow-brand px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("planner.suggestionCtaAria", { node: suggestion.nodeTitle })}
      >
        {t("planner.suggestionCta")}
      </Link>
    </article>
  );
}

/** The generation-backed suggestion card (spec decision 10): the 「AI 建议」
 * chip, the server-chosen node title, the reason line (the model's why —
 * readable, line-clamped), and the SAME nodeQuickTestHref deep link the v1
 * card uses. */
function AiSuggestionCard({ planId, reply }: { planId: string; reply: AiTodaySuggestionView }) {
  const { t } = useLanguage();
  return (
    <article className="bg-card border border-border-soft rounded-2xl p-4 shadow-raised flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-snug truncate">{reply.nodeTitle}</div>
        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{reply.reason}</div>
      </div>
      <span className="pill flex-none">{t("planner.aiChip")}</span>
      <Link
        to={nodeQuickTestHref(planId, reply.nodeId)}
        className="flex-none inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero text-white shadow-brand px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("planner.suggestionCtaAria", { node: reply.nodeTitle })}
      >
        {t("planner.suggestionCta")}
      </Link>
    </article>
  );
}

/** One plan's AI zone under the v1 card (spec decisions 7–9): the explicit
 * 「生成 AI 建议」 trigger — the ONLY path to the provider (nothing fires on
 * hub load). The mutation carries the DETERMINISTIC per-(user, plan, UTC
 * day) client uuid, so a remount's click replays server-side for free; a
 * same-mount re-click renders the held reply without a second call.
 * CAP_REACHED parks the trigger on a disabled cap note; every other closed-
 * enum code toasts its honest key with the trigger left usable. The v1 card
 * above is untouched — this zone is the ADDITION. */
function AiSuggestionZone({ planId, planTitle }: { planId: string; planTitle: string }) {
  const { t, language } = useLanguage();
  const generate = useGenerateTodaySuggestionMutation();
  const [reply, setReply] = useState<AiTodaySuggestionView | null>(null);
  const [capped, setCapped] = useState(false);
  const userUuid = authedUserUuid();

  const onGenerate = () => {
    if (reply || capped || generate.result.loading || !userUuid) return;
    generate.mutate({
      variables: {
        input: {
          clientUuid: todaySuggestionClientUuid(userUuid, planId, utcDayKey(new Date())),
          language,
          planId,
        },
      },
      onCompleted: (data) => {
        const row = data.generateTodaySuggestion?.todaySuggestion;
        if (row) setReply(mapAiTodaySuggestion(row));
      },
      onError: (error) => {
        const code = apiErrorCode(error);
        if (code === "CAP_REACHED") {
          setCapped(true); // the honest cap state — the trigger goes quiet
        }
        const key = (code && AI_GENERATION_KEYS[code]) || AI_GENERATION_FAILED_KEY;
        toast.error(t(key));
      },
    });
  };

  return (
    <div className="flex flex-col gap-2 items-start">
      {reply && <AiSuggestionCard planId={planId} reply={reply} />}
      <button
        type="button"
        onClick={onGenerate}
        disabled={capped || !userUuid || generate.result.loading}
        aria-label={t("planner.aiSuggestCtaAria", { plan: planTitle })}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55 disabled:hover:shadow-none disabled:hover:brightness-100 disabled:cursor-not-allowed cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        {capped ? t("planner.aiCapNote") : t("planner.aiSuggestCta")}
      </button>
    </div>
  );
}

/** One manual-task row: the completion toggle, the title, the optional due
 * day, and the delete. */
function ManualTaskRow({ task }: { task: HubManualTaskView }) {
  const { t } = useLanguage();
  const toggleTask = useSetManualTaskDoneMutation();
  const deleteTask = useDeleteManualTaskMutation();
  return (
    <div className={cn("flex items-start gap-3 py-3.5 px-1 border-b border-border-soft last:border-b-0", task.done && "done")}>
      <button
        type="button"
        onClick={() => toggleTask.mutate({ variables: { input: { id: task.id, done: !task.done } } })}
        aria-pressed={task.done}
        aria-label={task.done ? t("planner.markUndone") : t("planner.markDone")}
        className={cn(
          "w-[22px] h-[22px] rounded-full border-[1.5px] grid place-items-center flex-none mt-px cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          task.done ? "bg-mastered border-mastered text-white" : "border-[#d9cfc3] text-transparent hover:border-primary",
        )}
      >
        <Check className="w-3 h-3" aria-hidden="true" />
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-semibold leading-[1.45] transition-opacity", task.done && "line-through opacity-55")}>
          {task.title}
        </div>
        {task.dueDate && (
          <div className="text-[10px] text-muted-foreground mt-1">{t("planner.manualDueOn", { date: task.dueDate.slice(0, 10) })}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => deleteTask.mutate({ variables: { input: { id: task.id } } })}
        aria-label={t("planner.deleteTaskAria", { title: task.title })}
        className="flex-none rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function PlannerPage() {
  const { t } = useLanguage();
  const hubQuery = useTodayHubQuery();
  const consistencyQuery = useTodayConsistencyQuery();
  const streakQuery = useStreakQuery();
  const addTask = useAddManualTaskMutation();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (hubQuery.loading || consistencyQuery.loading) return null;

  const hub = hubQuery.data;
  const summary = hub?.summary ?? { dueCount: 0, manualCount: 0, doneCount: 0 };
  const due = hub?.due ?? [];
  const suggestions = hub?.suggestions ?? [];
  const manual = hub?.manual ?? [];

  const strip = todayWeekStrip(consistencyQuery.data ?? [], utcDayKey(new Date()));
  const todayKey = utcDayKey(new Date());
  const streak = streakQuery.data ?? 0;

  const submitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    addTask.mutate({
      variables: { input: { title: clean, dueDate: dueDate || null } },
      onCompleted: () => { setTitle(""); setDueDate(""); },
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      {/* Page head — the label rule: zh 今日学习, en Today */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("planner.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("planner.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("planner.subtitle")}</p>
        </div>
        <span className="pill pill-streak">
          <Flame className="w-[13px] h-[13px]" aria-hidden="true" />
          {t("dashboard.streak", { n: streak })}
        </span>
      </div>

      {/* Day-progress summary + the week strip */}
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("planner.dayProgress")}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill">{t("planner.summaryDue", { n: summary.dueCount })}</span>
            <span className="pill">{t("planner.summaryManual", { n: summary.manualCount })}</span>
            <span className="pill pill-muted">{t("planner.doneCount", { n: summary.doneCount })}</span>
          </div>
        </div>

        {/* The light week strip (Mon–Sun UTC, today highlighted). No-data
            days render hollow-dashed — the consistency series is 14 days
            deep; the week never invents evidence for days outside it. */}
        <div className="mt-4" role="img" aria-label={t("planner.weekStripAria")}>
          <div className="grid grid-cols-7 gap-2 max-w-[420px]">
            {strip.map((cell) => (
              <div key={cell.day} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    cell.day === todayKey ? "text-foreground font-bold" : "text-muted-foreground",
                  )}
                >
                  {t(cell.labelKey)}
                </span>
                <span
                  className={cn(
                    "w-full h-8 rounded-lg border grid place-items-center text-[10px] font-bold",
                    CELL_STATE_CLS[cell.state],
                    cell.day === todayKey && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                  )}
                  aria-hidden="true"
                >
                  {cell.state === "evidence" ? cell.sessions : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hubQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-3" role="alert">
          <p className="text-sm font-semibold">{t("planner.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void hubQuery.refetch()}
          >
            {t("planner.retry")}
          </button>
        </div>
      ) : due.length === 0 && manual.length === 0 && suggestions.length === 0 ? (
        /* The honest empty day — never a demo fallback */
        <div className="bg-card border border-border-soft rounded-2xl p-8 shadow-raised mt-3 text-center">
          <p className="text-sm font-semibold">{t("planner.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1.5">{t("planner.emptyBody")}</p>
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 mt-4 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("planner.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* Due re-queue reviews (epic-07's materialized schedule) */}
          {due.length > 0 && (
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 mt-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("planner.dueSection")}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("planner.dueSectionSub")}</p>
              <div className="flex flex-col mt-2">
                {due.map((item) => (
                  <DueItemRow key={`${item.kind}:${item.itemId}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* The suggestion slot (delta decision 2, v1 partial): the v1 card
              first, the AI zone under it — spec decision 7's addition, the
              v1 card's markup untouched. */}
          {suggestions.length > 0 && (
            <div className="mt-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] px-1">{t("planner.suggestionSection")}</h2>
              <div className="flex flex-col gap-3 mt-2">
                {suggestions.map((suggestion) => (
                  <Fragment key={suggestion.planId}>
                    <SuggestionCard suggestion={suggestion} />
                    <AiSuggestionZone planId={suggestion.planId} planTitle={suggestion.planTitle} />
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {/* The user's own manual tasks + the add form */}
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 mt-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("planner.manualSection")}</h2>
            {manual.length > 0 ? (
              <div className="flex flex-col mt-2">
                {manual.map((task) => (
                  <ManualTaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">{t("planner.manualEmpty")}</p>
            )}

            <form onSubmit={submitAdd} className="flex flex-wrap items-center gap-2 mt-4">
              <label className="sr-only" htmlFor="manual-task-title">{t("planner.addTitleLabel")}</label>
              <input
                id="manual-task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("planner.addTitlePlaceholder")}
                maxLength={200}
                className="flex-1 min-w-[200px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {t("planner.addDate")}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("planner.addDate")}
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {t("planner.addSubmit")}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

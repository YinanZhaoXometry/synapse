/**
 * The Quiz history hub (FR-42, epic P2-09 T4): every quiz session from the
 * quizHistoryHub read model (T1's api aggregation, newest first) with origin
 * chips, the mode, the log date, the question count, and the GRADED-answers
 * score summary — plus the hub's one write: the RETAKE. A retake fires
 * retakeQuizSession (the api mints the NEW session server-side from the old
 * one's scope + mode — never a replay of graded answers, NFR-8) and navigates
 * to the new session's FLOW route (/plan/:id/quiz?session= / /task/:id/
 * quiz?session=), where the existing resumption seam hydrates and runs it;
 * the fresh-launch marker rides along (the hub just started this round in
 * this tab). The retake action rides exactly the rows with graded answers —
 * evidence lands only at completion, so a zero-graded row is an in-progress
 * or abandoned session (the wire carries no status, so the row reads the
 * honest 未完成 label and never claims which). Filtering is client rendering
 * over the flat server-ordered list, never a re-aggregation; generation stays
 * in-flow (FR-19/FR-36) — new quizzes start inside a plan/task flow, and the
 * empty state links there. The epic-6 T5 material picker + its demo copy
 * retired with this re-point: a stale /quiz?session= link lands on the hub
 * (the history is the honest landing — the row's retake starts a fresh round).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleAlert, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useQuizHistoryHubQuery,
  useRetakeQuizSessionMutation,
  useTasksQuery,
  type HubQuizHistoryView,
} from "@/api";
import { QUIZ_FRESH_LAUNCH_KEY } from "@/features/quiz";
import { localeTag } from "@/features/plans";
import PageLoader from "@/components/shared/PageLoader";

/** The retake launch: fire the mutation; on the NEW session's arrival, mark
 * the fresh launch and navigate to its flow route per origin kind. The api
 * guarantees exactly one owner (the ER's exactly-one-owner law), so the scope
 * read here is `plan xor task` by construction. */
function useRetakeAndNavigate() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const retake = useRetakeQuizSessionMutation();

  const retakeSession = (row: HubQuizHistoryView) => {
    retake.mutate({
      variables: { input: { sessionId: row.sessionId, language } },
      onCompleted: (data) => {
        const session = data.retakeQuizSession?.session;
        if (!session) return;
        sessionStorage.setItem(QUIZ_FRESH_LAUNCH_KEY, session.id);
        if (session.planId) {
          navigate(`/plan/${encodeURIComponent(session.planId)}/quiz?session=${encodeURIComponent(session.id)}`);
        } else if (session.taskId) {
          navigate(`/task/${encodeURIComponent(session.taskId)}/quiz?session=${encodeURIComponent(session.id)}`);
        }
      },
    }).catch(() => {
      // the hook's onError already toasted; the history stays put
    });
  };

  return { retakeSession, retaking: retake.result.loading };
}

/** One history row: origin chip, mode chip, date, question count, and the
 * score summary — or the honest zero-graded label. The retake button rides
 * only the graded rows. */
function HistoryRow({ row, taskTitle, onRetake, retaking }: {
  row: HubQuizHistoryView;
  taskTitle: (taskId: string) => string;
  onRetake: (row: HubQuizHistoryView) => void;
  retaking: boolean;
}) {
  const { t, language } = useLanguage();
  const originLabel = row.taskId ? taskTitle(row.taskId) : row.planTitle ?? row.planId;
  const modeKey = row.mode === "open" ? "quizHub.modeOpen" : row.mode === "choice" ? "quizHub.modeChoice" : "quizHub.modeMix";
  const graded = row.scoreSummary.total > 0;
  const dateLabel = new Date(row.createdAt).toLocaleDateString(localeTag(language));

  return (
    <article className="bg-card border border-border-soft rounded-2xl p-5 shadow-raised">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="pill">{originLabel}</span>
        <span className="text-[10px] text-caption">{dateLabel}</span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="pill pill-muted">{t(modeKey)}</span>
        <span className="pill pill-muted">{t("quizHub.questions", { n: row.questionCount })}</span>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
        {graded ? (
          <span className="text-sm font-semibold tabular-nums" data-testid={`quiz-history-score-${row.sessionId}`}>
            {t("quizHub.scoreSummary", { correct: row.scoreSummary.correct, total: row.scoreSummary.total })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t("quizHub.ungraded")}</span>
        )}
        {graded && (
          <button
            type="button"
            data-testid={`quiz-retake-${row.sessionId}`}
            onClick={() => onRetake(row)}
            disabled={retaking}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            aria-label={t("quizHub.retakeAria")}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            {t("quizHub.retake")}
          </button>
        )}
      </div>
    </article>
  );
}

export default function QuizPage() {
  const { t } = useLanguage();
  const hubQuery = useQuizHistoryHubQuery();
  const tasksQuery = useTasksQuery();
  const [filter, setFilter] = useState("");
  const { retakeSession, retaking } = useRetakeAndNavigate();

  const rows = hubQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  // The task row's title resolves off the tasks list read (the wire carries
  // the task ID only — the MistakesPage convention); plan titles ride the
  // wire. An unresolvable id renders raw (honest, never a guessed title).
  const taskTitle = (taskId: string) => tasks.find((task) => task.id === taskId)?.node.title ?? taskId;

  // The filter's origin set: first occurrence over the flat list (recency-
  // shaped, matching the server order) — rendering, not re-aggregation.
  const origins = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const key = row.taskId ? `task:${row.taskId}` : `plan:${row.planId}`;
      if (!seen.has(key)) seen.set(key, row.taskId ? taskTitle(row.taskId) : row.planTitle ?? row.planId ?? "");
    }
    return [...seen.entries()];
  }, [rows, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRows = filter ? rows.filter((row) => (row.taskId ? `task:${row.taskId}` : `plan:${row.planId}`) === filter) : rows;

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (hubQuery.loading || tasksQuery.loading) return <PageLoader />;

  return (
    <div className="max-w-[984px] mx-auto px-6 py-8">
      {/* Page head */}
      <div>
        <p className="eyebrow">{t("quizHub.eyebrow")}</p>
        <h1 className="page-title mt-1.5">{t("quizHub.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{t("quizHub.subtitle", { n: rows.length })}</p>
      </div>

      {hubQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-6" role="alert">
          <p className="text-sm font-semibold">{t("quizHub.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void hubQuery.refetch()}
          >
            {t("quizHub.retry")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border-soft rounded-2xl p-8 shadow-raised mt-6 text-center">
          <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold mt-2">{t("quizHub.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1.5">{t("quizHub.emptyBody")}</p>
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 mt-4 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("quizHub.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* The plan/task filter (the read model is flat — filtering is rendering) */}
          <label className="flex items-center gap-2 mt-5 text-xs text-muted-foreground">
            {t("quizHub.filterLabel")}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("quizHub.filterAll")}</option>
              {[...origins].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3 mt-4">
            {visibleRows.map((row) => (
              <HistoryRow key={row.sessionId} row={row} taskTitle={taskTitle} onRetake={retakeSession} retaking={retaking} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

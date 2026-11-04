/**
 * QuizSessionPage (epic-6 T4): the shared quiz ROUTE SHELL — everything the
 * /plan/:id/quiz and /task/:id/quiz pages have in common, extracted so the
 * task loop behaves identically to its plan twin by construction (AC: twin
 * parity), not by copy-paste. One driver of states:
 * - no ?session → the QuizLauncher inline (mode + scope on plans; mode only on
 *   tasks — the single material IS the scope);
 * - ?session=<active> → hydrate and run (the session id lives in the URL so a
 *   reload resumes — resumption lands on question 1, announced honestly);
 * - ?session=<terminal> → honest card: completed/abandoned sessions are NOT
 *   resumable (the machine refuses); unknown or foreign-owner ids read as
 *   not-found.
 * 再来一轮 = a fresh generated session with the SAME launch params (kept only
 * for this mount — after a reload the terminal card offers the launcher
 * instead). The surface composes this with its own context: plan lookup vs
 * task lookup, back targets, and the honest not-found copy. T5's /quiz demo
 * reuses the same shell by DERIVING the owner context (plan or task) from the
 * picked material / the session itself, with `scopeLocked` + `launchHeader`
 * for its picker-instead-of-fixed-materials shape (AD-6 ownership unchanged:
 * a session still attributes to exactly one plan or task).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllEvidenceQuery, useQuizSessionQuery } from "@/api";
import type { KnowledgeNodeView, MaterialView } from "@/api/views";
import { QuizLauncher } from "./QuizLauncher";
import { QuizRunner } from "./QuizRunner";
import { useQuizSession, QUIZ_FRESH_LAUNCH_KEY, type QuizStartInput } from "./use-quiz-session";

/** Where the session lives and who owns it (AD-6): a plan or a task. */
export interface QuizSessionContext {
  kind: "plan" | "task";
  /** The owning plan/task id — sessions of OTHER owners read as not-found. */
  ownerId: string;
  /** False → the honest not-found card (unknown plan/task id). */
  exists: boolean;
  /** The owner's nodes — the results' mastery rows (task: its single node); SERVER-scored views (AD-14). */
  nodes: KnowledgeNodeView[];
  /** The owner's materials — generation input, hints, source excerpts. */
  materials: MaterialView[];
  /** Back from the session: results exit, abandoned exit, terminal cards. */
  homeHref: string;
  homeLabelKey: string;
  /** Back when the owner itself is unknown (never a trap). */
  lostHref: string;
  lostLabelKey: string;
  /** The not-found copy — plans.notFound / tasks.notFound. */
  notFoundKey: string;
  /**
   * T5 (the /quiz demo surface): the surface has already fixed the quiz scope
   * (its picker picked the single material carried in `materials`) — the
   * inline launcher renders the mode select only. Plans/tasks never set it.
   */
  scopeLocked?: boolean;
  /** Optional context strip above the inline launcher (demo: the picked material + its owner label). */
  launchHeader?: ReactNode;
}

/** The launch record for 再来一轮: the exact start input + the 「来自 N 份材料」 count. */
interface LaunchRecord {
  input: QuizStartInput;
  materialCount: number;
}

export function QuizSessionPage({ context }: { context: QuizSessionContext }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");

  const evidenceQuery = useAllEvidenceQuery();
  // The session's own truth is the api's session query (the cutover replaces
  // the synchronous repository read): data arrives mapped with questions
  // hydrated; an unknown/foreign id returns NOT_FOUND → data stays undefined
  // and the honest not-found card renders below.
  const sessionQuery = useQuizSessionQuery(sessionParam ?? "");
  const driver = useQuizSession({ materials: context.materials });

  const launchRef = useRef<LaunchRecord | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [hydrateFailed, setHydrateFailed] = useState(false);
  const hydratedRef = useRef<string | null>(null);
  // T6: the session this TAB launched fresh (dialog or inline), consumed from
  // sessionStorage once (see QUIZ_FRESH_LAUNCH_KEY). A genuine reload finds no
  // marker — the resumed note below keeps its reload-resume-only meaning.
  const freshLaunchRef = useRef<string | null>(null);

  const evidence = evidenceQuery.data ?? [];

  const backLink = (
    <button
      type="button"
      onClick={() => navigate(context.exists ? context.homeHref : context.lostHref)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {t(context.exists ? context.homeLabelKey : context.lostLabelKey)}
    </button>
  );

  const session = sessionParam ? sessionQuery.data : undefined;
  // AD-6 ownership: a session of ANOTHER plan/task is never this surface's.
  const owns =
    !!session && (context.kind === "plan" ? session.planId === context.ownerId : session.taskId === context.ownerId);

  // Consume the fresh-launch marker for THIS session id before the hydrate
  // effect runs (declaration order): a dialog launch lands here with ?session
  // already set and must not render the reload-resume note (T6).
  useEffect(() => {
    if (!sessionParam) return;
    if (sessionStorage.getItem(QUIZ_FRESH_LAUNCH_KEY) === sessionParam) {
      freshLaunchRef.current = sessionParam;
      sessionStorage.removeItem(QUIZ_FRESH_LAUNCH_KEY);
    }
  }, [sessionParam]);

  // Hydrate an ACTIVE session of THIS owner once per URL id (resumption;
  // terminal sessions are refused by the machine — the render shows the honest
  // terminal card; a foreign owner's id reads as not-found, never hydrates).
  useEffect(() => {
    if (!sessionParam || !context.exists || hydrateFailed || sessionQuery.loading) return;
    if (hydratedRef.current === sessionParam || driver.run) return;
    if (!session || session.status !== "active" || !owns) return;
    hydratedRef.current = sessionParam;
    const ok = driver.hydrate(session);
    if (!ok) setHydrateFailed(true);
  }, [sessionParam, session, sessionQuery.loading, context.exists, owns]); // eslint-disable-line react-hooks/exhaustive-deps

  // A retake landing: the driver produced a NEW session — carry its id in the
  // URL (spec decision 7) so the new round survives a reload too.
  useEffect(() => {
    const sid = driver.run?.sessionId;
    if (sid && sid !== sessionParam) {
      setSearchParams(new URLSearchParams({ session: sid }));
    }
  }, [driver.run?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (evidenceQuery.loading || (sessionParam && sessionQuery.loading)) return null;

  if (!context.exists) {
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        {backLink}
        <p className="page-title mt-6 text-lg">{t(context.notFoundKey)}</p>
      </div>
    );
  }

  // 再来一轮 in flight: 「来自 N 份材料 · 正在出题」, cancellable (a cancel leaves
  // no live session — the driver guarantees it); failure lands back on results.
  if (retaking && driver.phase === "generating") {
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-retaking-page">
        {backLink}
        <div className="mt-6 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center">
          <Loader2 className="w-5 h-5 mx-auto animate-spin text-accent-ink" aria-hidden="true" />
          <p className="text-sm font-semibold mt-3" data-testid="quiz-retaking">
            {t("quiz.launcher.generating", { n: launchRef.current?.materialCount ?? 0 })}
          </p>
          <button
            type="button"
            onClick={() => {
              driver.cancelStart();
              setRetaking(false);
            }}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-[var(--glass-4)] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
          >
            {t("quiz.launcher.cancel")}
          </button>
        </div>
      </div>
    );
  }

  // The live run (launched here or hydrated) — the runner owns question,
  // verdict pacing, AND the completed-run results screen, so it stays mounted
  // through completion. The resume note shows ONLY for a genuine
  // reload-resume: a fresh launch through the launcher hydrated this same
  // tick, but claiming 「已恢复」 then would be its own little lie.
  if (driver.run && driver.phase !== "generating" && driver.run.status !== "abandoned") {
    return (
      <QuizRunner
        driver={driver}
        run={driver.run}
        materials={context.materials}
        nodes={context.nodes}
        evidence={evidence}
        resumed={
          !launchRef.current &&
          freshLaunchRef.current !== driver.run.sessionId &&
          sessionParam === driver.run.sessionId &&
          hydratedRef.current === driver.run.sessionId
        }
        canRetake={!!launchRef.current}
        backLabelKey={context.homeLabelKey}
        onRetake={() => {
          const record = launchRef.current;
          if (!record) return;
          setRetaking(true);
          driver
            .start(record.input)
            .catch(() => toast(t("quiz.launcher.failed")))
            .finally(() => setRetaking(false));
        }}
        onBackToPlan={() => navigate(context.homeHref)}
        onAbandoned={() => navigate(context.homeHref)}
      />
    );
  }

  // A ?session that is not a live run: honest state per repository status.
  if (sessionParam) {
    const terminalActions = (
      <>
        <button
          type="button"
          data-testid="quiz-terminal-new"
          onClick={() => setSearchParams({}, { replace: true })}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
        >
          {t("quiz.startNew")}
        </button>
        <button
          type="button"
          onClick={() => navigate(context.homeHref)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
        >
          {t(context.homeLabelKey)}
        </button>
      </>
    );
    const card = (titleKey: string, testId: string) => (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid={testId}>
        {backLink}
        <div className="mt-6 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center">
          <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold mt-2">{t(titleKey)}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{t("quiz.runner.notResumable")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">{terminalActions}</div>
        </div>
      </div>
    );
    if (!session || !owns || hydrateFailed) return card("quiz.runner.notFound", "quiz-session-unknown");
    if (session.status === "completed") return card("quiz.runner.alreadyDone", "quiz-session-terminal");
    if (session.status === "abandoned") return card("quiz.runner.alreadyAbandoned", "quiz-session-terminal");
    return null; // active — the hydrate effect owns this tick
  }

  // No session yet → the launcher inline (the abandoned phase after an exit
  // navigates away via onAbandoned before this branch can commit).
  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-launch-page">
      {backLink}
      <div className="mt-6 rounded-2xl border border-border-soft bg-card p-6 md:p-8 shadow-raised">
        {context.launchHeader}
        <QuizLauncher
          planId={context.kind === "plan" ? context.ownerId : null}
          taskId={context.kind === "task" ? context.ownerId : null}
          nodeIds={context.nodes.map((n) => n.id)}
          materials={context.materials}
          scopeLocked={context.scopeLocked}
          onStarted={(sessionId, input) => {
            launchRef.current = { input, materialCount: input.materials.length };
            setSearchParams(new URLSearchParams({ session: sessionId }));
          }}
        />
      </div>
    </div>
  );
}

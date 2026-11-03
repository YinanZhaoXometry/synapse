/**
 * Plan-flow quiz route — /plan/:id/quiz (epic-6 T2; FR-18; AD-8): the quiz
 * session page under the app layout. States over one driver:
 * - no ?session → the QuizLauncher inline (mode + scope; unknown plan → the
 *   same honest not-found as Plan Home, never a blank screen);
 * - ?session=<active> → hydrate and run (the session id lives in the URL so a
 *   reload resumes — T1 resumes at question 1, announced honestly);
 * - ?session=<terminal> → honest card: completed/abandoned sessions are NOT
 *   resumable (the machine refuses); unknown or foreign-plan ids read as
 *   not-found.
 * 再来一轮 = a fresh generated session with the SAME launch params (kept only
 * for this mount — after a reload the terminal card offers the launcher
 * instead; the original scope is simply not known). Delegates to features/quiz.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { getQuizSession, useAllEvidenceQuery, usePlanMaterialsQuery, usePlanNodesQuery, usePlanQuery } from "@/data";
import { QuizLauncher, QuizRunner, useQuizSession, type QuizStartInput } from "@/features/quiz";

/** The launch record for 再来一轮: the exact start input + the 「来自 N 份材料」 count. */
interface LaunchRecord {
  input: QuizStartInput;
  materialCount: number;
}

function BackToPlans({ navigate, label }: { navigate: ReturnType<typeof useNavigate>; label: string }) {
  return (
    <button
      type="button"
      onClick={() => navigate("/plans")}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </button>
  );
}

export default function PlanQuizPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");

  const planQuery = usePlanQuery(id ?? "");
  const nodesQuery = usePlanNodesQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");
  const evidenceQuery = useAllEvidenceQuery();
  const driver = useQuizSession();

  const launchRef = useRef<LaunchRecord | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [hydrateFailed, setHydrateFailed] = useState(false);
  const hydratedRef = useRef<string | null>(null);

  const plan = planQuery.data;
  const nodes = nodesQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const evidence = evidenceQuery.data ?? [];

  // The session's own truth is a synchronous repository read (the store is
  // local; a query hook would pend forever on an unknown id — undefined is
  // not data in TanStack terms). Status below drives the honest branches.
  const session = sessionParam ? getQuizSession(sessionParam) : undefined;

  // Hydrate an ACTIVE session of THIS plan once per URL id (T2 resumption;
  // terminal sessions are refused by the machine — the render shows the honest
  // terminal card; a foreign plan's id reads as not-found, never hydrates).
  useEffect(() => {
    if (!sessionParam || !plan || hydrateFailed) return;
    if (hydratedRef.current === sessionParam || driver.run) return;
    if (!session || session.status !== "active" || session.planId !== plan.id) return;
    hydratedRef.current = sessionParam;
    const ok = driver.hydrate(sessionParam);
    if (!ok) setHydrateFailed(true);
  }, [sessionParam, session, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // A retake landing: the driver produced a NEW session — carry its id in the
  // URL (spec decision 7) so the new round survives a reload too.
  useEffect(() => {
    const sid = driver.run?.sessionId;
    if (sid && sid !== sessionParam) {
      setSearchParams(new URLSearchParams({ session: sid }));
    }
  }, [driver.run?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (planQuery.isPending || nodesQuery.isPending || materialsQuery.isPending || evidenceQuery.isPending) return null;

  if (!plan) {
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        <BackToPlans navigate={navigate} label={t("plans.backToPlans")} />
        <p className="page-title mt-6 text-lg">{t("plans.notFound")}</p>
      </div>
    );
  }

  const backLink = <BackToPlans navigate={navigate} label={t("plans.backToPlans")} />;

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
        materials={materials}
        nodes={nodes}
        evidence={evidence}
        resumed={!launchRef.current && sessionParam === driver.run.sessionId && hydratedRef.current === driver.run.sessionId}
        canRetake={!!launchRef.current}
        onRetake={() => {
          const record = launchRef.current;
          if (!record) return;
          setRetaking(true);
          driver
            .start(record.input)
            .catch(() => toast(t("quiz.launcher.failed")))
            .finally(() => setRetaking(false));
        }}
        onBackToPlan={() => navigate(`/plan/${plan.id}`)}
        onAbandoned={() => navigate(`/plan/${plan.id}`)}
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
          onClick={() => navigate(`/plan/${plan.id}`)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
        >
          {t("quiz.backToPlan")}
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
    if (!session || session.planId !== plan.id || hydrateFailed) return card("quiz.runner.notFound", "quiz-session-unknown");
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
        <QuizLauncher
          planId={plan.id}
          nodeIds={nodes.map((n) => n.id)}
          materials={materials}
          onStarted={(sessionId, input) => {
            launchRef.current = { input, materialCount: input.materials.length };
            setSearchParams(new URLSearchParams({ session: sessionId }));
          }}
        />
      </div>
    </div>
  );
}

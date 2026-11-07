import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { BookOpen, GitFork, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  useAllMaterialsQuery,
  useAllReadingProgressQuery,
  usePlanNodesQuery,
  usePlansQuery,
  useTaskMaterialsQuery,
  useTaskNodeQuery,
  useTasksQuery,
} from "@/api";
import type { ReadingProgress } from "@/domain/entities";
import type { StudyPlanView, StudyTaskView } from "@/api/views";
import { taskContinueTarget, tasksNewestFirst } from "@/features/tasks";
import { shouldOfferImport } from "@/lib/import-offer";
import { latestReading, mostRecentPlan, planCardMetrics, type LatestReadingView } from "./display-shaping";
import { localeTag } from "./locale";
import { MasteryRing, StateMiniBar } from "./atoms";
import CreationChat from "./CreationChat";
import ImportOfferDialog from "./ImportOfferDialog";
import SquareSection from "./SquareSection";
import { cn } from "@/lib/utils";

/**
 * Plans Home (AD-8; FR-1; Q3/Q5) — the front door. Empty state: the creation
 * chat is the primary surface (SM-1, no seeded demo data) with the Study Task
 * pitch beside it (FR-37/UJ-6 — the second door is visible from the first
 * visit). Returning state: continue hero for the most recent plan (rollup +
 * recency) + the 「上次读到」 line from the most recent reading across plans
 * (FR-25; epic-2's deferral closes here) + plan cards with honest rollup chips
 * and node-state mini bars + create-new and create-task actions persisting
 * side by side. When ≥ 1 task exists, a Study Tasks section renders (FR-37;
 * T3): rows of title + single-node Mastery Ring + a continue-reading deep
 * link, newest first; at zero tasks it renders nothing — no empty chrome.
 * Every number is SERVER truth since the cutover (AD-14): rollups and states
 * ride the api's masteryScore/state — the page never recomputes.
 *
 * Epic P2-11 T3 (FR-39, delta decision 3): the 我的计划 / 广场 pill toggle —
 * the Square (external-plan discovery) is a TAB on the plans front door, NOT
 * a new sidebar destination (the sidebar's ten retained destinations stay
 * frozen). The mine tab renders exactly what shipped before; the Square tab
 * renders SquareSection (public-plan cards + adopt).
 */
export default function PlansHomePage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const plansQuery = usePlansQuery();
  const tasksQuery = useTasksQuery();
  const progressQuery = useAllReadingProgressQuery();
  // The Square tab (delta decision 3): the mine tab keeps every existing
  // surface; the Square tab swaps the body (public-plan discovery).
  const [searchParams] = useSearchParams();
  // Square deep-link (?tab=square — the square preview's back link restores
  // the tab the user left); anything else opens on the mine tab.
  const [tab, setTab] = useState<"mine" | "square">(searchParams.get("tab") === "square" ? "square" : "mine");

  if (plansQuery.loading || tasksQuery.loading || progressQuery.loading) return null;
  const plans = plansQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const progress = progressQuery.data ?? [];
  const isEmpty = plans.length === 0;

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      {/* The first-login import offer (epic P2-8 T3, AD-15): one-time, only
          when the legacy document holds data and the offer is unspent. */}
      {shouldOfferImport() && <ImportOfferDialog />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("plans.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{isEmpty ? t("plans.emptyTitle") : t("plans.returningTitle")}</h1>
        </div>
        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/plan/new")}>
              <Plus className="w-4 h-4 mr-1.5" /> {t("plans.createNew")}
            </Button>
            {/* the Study Task action persists beside create-new (UX spine PlansHome row) */}
            <Button variant="outline" onClick={() => navigate("/task/new")}>
              <BookOpen className="w-4 h-4 mr-1.5" /> {t("tasks.createEntry")}
            </Button>
          </div>
        )}
      </div>

      {/* The 广场 toggle (delta decision 3): 我的计划 / 广场 pill pair — the
          plans front door hosts external-plan discovery; no new sidebar slot. */}
      <div className="flex items-center gap-2 mt-3" role="group" aria-label={t("square.tabAria")} data-testid="plans-home-tabs">
        <button
          type="button"
          aria-pressed={tab === "mine"}
          onClick={() => setTab("mine")}
          className={cn("pill cursor-pointer", tab !== "mine" && "pill-muted")}
        >
          {t("square.tabMine")}
        </button>
        <button
          type="button"
          aria-pressed={tab === "square"}
          onClick={() => setTab("square")}
          className={cn("pill cursor-pointer", tab !== "square" && "pill-muted")}
        >
          {t("square.tabSquare")}
        </button>
      </div>

      {tab === "square" ? (
        <SquareSection />
      ) : (
        <>
          {isEmpty ? (
            <>
              <div className="glass-panel rounded-2xl shadow-raised p-4 mt-4 flex flex-wrap items-center gap-3">
                <BookOpen className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
                <p className="text-sm font-medium leading-[1.5] flex-1 min-w-[220px]">{t("tasks.pitch")}</p>
                <Button variant="outline" size="sm" className="flex-none" onClick={() => navigate("/task/new")}>
                  {t("tasks.createEntry")}
                </Button>
              </div>
              <CreationChat />
            </>
          ) : (
            <ReturningHome plans={plans} language={language} />
          )}

          <TaskSection tasks={tasks} progress={progress} />
        </>
      )}
    </div>
  );
}

/** Returning state (Q5): continue hero + plan cards, numbers from the server fields only. */
function ReturningHome({ plans, language }: { plans: StudyPlanView[]; language: "zh" | "en" }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const hero = mostRecentPlan(plans);
  const recency = hero ? new Date(hero.createdAt).toLocaleDateString(localeTag(language)) : null;
  // The 「上次读到」 line (FR-25; T4): the most recent resumable reading across
  // plans — shaped by the pure selector over the cross-material queries; while
  // they settle (and when nothing is resumable) the line stays hidden honestly.
  const materialsQuery = useAllMaterialsQuery();
  const progressQuery = useAllReadingProgressQuery();
  const reading = latestReading(progressQuery.data ?? [], materialsQuery.data ?? []);

  return (
    <>
      {hero && recency && (
        <button
          type="button"
          onClick={() => navigate(`/plan/${hero.id}`)}
          className="w-full text-left bg-card border border-border-soft rounded-2xl shadow-raised p-5 mt-4 flex items-center gap-5 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
        >
          <ContinueHeroBody plan={hero} recency={recency} reading={reading} />
          <span className="pill pill-mastered flex-none">{t("plans.continueAction")}</span>
        </button>
      )}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </>
  );
}

/** Hero rollup: the hero card's own nodes via its query (state bar) + the last-read line. */
function ContinueHeroBody({
  plan,
  recency,
  reading,
}: {
  plan: StudyPlanView;
  recency: string;
  reading: LatestReadingView | null;
}) {
  const { t } = useLanguage();
  const nodesQuery = usePlanNodesQuery(plan.id);
  const nodes = nodesQuery.data ?? [];
  const metrics = planCardMetrics(plan, nodes);
  return (
    <>
      <MasteryRing value={metrics.rollup} size={64} />
      <div className="flex-1 min-w-0">
        <p className="eyebrow">
          {t("plans.continueEyebrow")} · {recency}
        </p>
        <p className="font-display font-bold text-lg leading-snug truncate mt-0.5">{plan.topic}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {nodes.length} {t("plans.nodesUnit")} · {(nodesQuery.materials ?? []).length} {t("plans.materialsUnit")}
        </p>
        {reading && (
          <p className="text-[11px] text-accent-ink leading-[1.5] truncate mt-1.5">
            {reading.locator.kind === "pdf"
              ? t("plans.lastReadPage", { material: reading.material.title, n: reading.locator.page })
              : reading.sectionTitle
                ? t("plans.lastReadSection", {
                    material: reading.material.title,
                    section: reading.sectionTitle,
                  })
                : t("plans.lastReadMaterial", { material: reading.material.title })}
          </p>
        )}
      </div>
    </>
  );
}

/** One plan card (Q5): honest rollup chip + node-state mini bar + node/material counts. */
function PlanCard({ plan }: { plan: StudyPlanView }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const nodesQuery = usePlanNodesQuery(plan.id);
  const nodes = nodesQuery.data ?? [];
  const metrics = planCardMetrics(plan, nodes);
  return (
    <button
      type="button"
      onClick={() => navigate(`/plan/${plan.id}`)}
      className="text-left bg-card border border-border-soft rounded-2xl shadow-raised p-4 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm truncate">{plan.topic}</p>
        <span className="font-display font-bold tabular-nums text-sm text-accent-ink flex-none">
          {metrics.rollup}%
        </span>
      </div>
      <StateMiniBar counts={metrics.stateCounts} />
      <p className="text-[11px] text-muted-foreground mt-2">
        {nodes.length} {t("plans.nodesUnit")} · {(nodesQuery.materials ?? []).length} {t("plans.materialsUnit")}
      </p>
      {/* The fork attribution (OQ-12, epic P2-11 T3): a small glyph + the
          source topic snapshot, straight off the server field. */}
      {plan.forkedFromTopic && (
        <p
          className="flex items-center gap-1 text-[11px] text-accent-ink mt-1.5 truncate"
          title={t("square.forkAria", { topic: plan.forkedFromTopic })}
          data-testid="plan-card-fork"
        >
          <GitFork className="w-3 h-3 flex-none" aria-hidden="true" />
          <span className="truncate">{plan.forkedFromTopic}</span>
        </p>
      )}
    </button>
  );
}

/**
 * The Study Tasks section (FR-37; T3): the learner's plan-free library. Absent
 * entirely at zero tasks — no empty chrome. Rows newest first; every number
 * and link target arrives through the tasks feature's pure selectors.
 */
function TaskSection({ tasks, progress }: { tasks: StudyTaskView[]; progress: ReadingProgress[] }) {
  const { t } = useLanguage();
  if (tasks.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-2">{t("tasks.eyebrow")}</h2>
      <div className="space-y-2">
        {tasksNewestFirst(tasks).map((task) => (
          <TaskRow key={task.id} task={task} progress={progress} />
        ))}
      </div>
    </section>
  );
}

/**
 * One task row: title + single-node Mastery Ring deep-linking to the task home
 * route, plus the continue-reading link into the reader at the stored position
 * (FR-10) — plain 打开 when no position, 继续 over the reader's anchor channel
 * when there is one (label split from the selector, never recomputed here).
 */
function TaskRow({ task, progress }: { task: StudyTaskView; progress: ReadingProgress[] }) {
  const { t } = useLanguage();
  const materialsQuery = useTaskMaterialsQuery(task.id);
  const node = task.node; // the task's auto-owned node, server-scored (AD-6/AD-14)
  const material = materialsQuery.data?.[0]; // strictly 1:1 (StudyTask ||--|| Material)
  const title = material?.title ?? node?.title ?? "";
  const target = material ? taskContinueTarget(material, progress) : null;
  return (
    <div className="bg-card border border-border-soft rounded-2xl shadow-raised px-4 py-3 flex items-center gap-4">
      <Link
        to={`/task/${task.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <MasteryRing value={node ? Number(node.masteryScore) : 0} size={44} />
        <span className="text-sm font-semibold truncate">{title}</span>
      </Link>
      {target && (
        <Link
          to={target.href}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
          title={t(target.resumable ? "plans.continueReading" : "common.open")}
        >
          <BookOpen className="w-3 h-3" aria-hidden="true" />
          {t(target.resumable ? "plans.continueReading" : "common.open")}
        </Link>
      )}
    </div>
  );
}

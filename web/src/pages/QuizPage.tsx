/**
 * /quiz — the standalone quiz surface, re-pointed (epic-6 T5; spec decision
 * 10; FR-36 carve-out). The scaffold demo is gone: its hardcoded question
 * bank, fake generation timer, and additive mastery deltas into the frozen
 * scaffold progress context no longer exist here. What remains is the real
 * seam reached OUTSIDE plan context (the demo is owner-agnostic — the user
 * never navigates through a plan to get here, but AD-6 still holds):
 *
 *   picker (every db material, labeled with its owning plan/task) →
 *   real generateQuiz through the AI seam → the shared QuizSessionPage
 *   machinery (launcher → runner → evidence → results).
 *
 * Every session attributes to exactly one plan or task — the owner of the
 * picked material — so this surface demonstrates the same evidence loop the
 * twins run; it is not a fourth owner. The owner context is DERIVED: from the
 * picked material on the launch state, from the session itself on the session
 * state. Honest edges: a fresh user gets an empty state with plan/task
 * creation paths, an unknown/deleted reference gets the not-found card, and a
 * material with no owner (or nothing to quiz from) never enters the picker.
 */
import { Link, useSearchParams } from "react-router-dom";
import { FileText, HelpCircle, Layers, ListChecks, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getMaterial,
  getQuizSession,
  useAllMaterialsQuery,
  usePlanMaterialsQuery,
  usePlanNodesQuery,
  usePlanQuery,
  usePlansQuery,
  useTaskMaterialsQuery,
  useTaskNodeQuery,
  useTaskQuery,
  useTasksQuery,
} from "@/data";
import type { Material } from "@/domain/entities";
import { QuizSessionPage, quizableMaterials, type QuizSessionContext } from "@/features/quiz";

/** Common back edges: every demo state returns to the picker, never a trap. */
const DEMO_BACK = {
  homeHref: "/quiz",
  homeLabelKey: "quiz.demo.backToPicker",
  lostHref: "/quiz",
  lostLabelKey: "quiz.demo.backToPicker",
} as const;

/** An honest dead-end card: unknown/lost references go back to the picker. */
function lostContext(notFoundKey: string): QuizSessionContext {
  return { kind: "plan", ownerId: "", exists: false, nodes: [], materials: [], ...DEMO_BACK, notFoundKey };
}

/** The picked-material strip above the inline launcher (picker → launcher continuity). */
function PickedMaterialStrip({ material, ownerLabel }: { material: Material; ownerLabel: string }) {
  return (
    <div
      className="mb-4 flex items-center gap-2.5 rounded-xl border border-border-soft bg-[var(--glass-2)] px-3.5 py-2.5"
      data-testid="quiz-demo-picked"
    >
      <FileText className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
      <span className="text-[13px] font-semibold truncate min-w-0">{material.title}</span>
      <span className="ml-auto text-[10px] text-muted-foreground flex-none">{ownerLabel}</span>
    </div>
  );
}

/** One picker row: the material + its owning context label (AD-6, honestly attributed). */
function PickerRow({ material, ownerLabel, onPick }: { material: Material; ownerLabel: string; onPick: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      role="radio"
      data-testid={`quiz-demo-material-${material.id}`}
      onClick={onPick}
      className="flex items-center gap-2.5 rounded-xl border border-border-soft px-3 py-2.5 text-left transition-colors hover:border-[color:var(--accent-edge)] hover:bg-[var(--glass-2)] cursor-pointer min-w-0"
    >
      <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{material.title}</span>
        <span className="block truncate text-[10px] text-muted-foreground mt-0.5">{ownerLabel}</span>
      </span>
      <span className="text-[10px] text-muted-foreground flex-none">
        {t("plans.parseParsed", { n: material.sections.length })}
      </span>
    </button>
  );
}

/** The picker state: every quizable, owned material in the db with its owner label. */
function MaterialPicker({ onPick }: { onPick: (materialId: string) => void }) {
  const { t } = useLanguage();
  const materialsQuery = useAllMaterialsQuery();
  const plansQuery = usePlansQuery();
  const tasksQuery = useTasksQuery();

  if (materialsQuery.isPending || plansQuery.isPending || tasksQuery.isPending) return null;

  const plans = plansQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const rows = (materialsQuery.data ?? [])
    .filter((m) => quizableMaterials([m]).length > 0)
    .map((m) => {
      // The owner label IS the attribution (AD-6): plan topic / task title
      // (= its material's title, the TaskRow convention). A material whose
      // owner no longer resolves is excluded honestly — never an invented label.
      const ownerLabel = m.planId
        ? plans.some((p) => p.id === m.planId)
          ? t("quiz.demo.fromPlan", { plan: plans.find((p) => p.id === m.planId)!.topic })
          : null
        : m.taskId && tasks.some((task) => task.id === m.taskId)
          ? t("quiz.demo.fromTask", { task: m.title })
          : null;
      return { material: m, ownerLabel };
    })
    .filter((row) => row.ownerLabel !== null);

  if (rows.length === 0) {
    // The honest empty state (fresh user / nothing parsed yet): paths forward, never a dead end.
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-demo-empty">
        <p className="eyebrow">{t("quiz.eyebrow")}</p>
        <h1 className="page-title">{t("quiz.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("quiz.subtitle")}</p>
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center">
          <HelpCircle className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold mt-2">{t("quiz.demo.emptyTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-[1.6]">{t("quiz.demo.emptyBody")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              to="/plans"
              data-testid="quiz-demo-goto-plans"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              {t("quiz.demo.createPlan")}
            </Link>
            <Link
              to="/task/new"
              data-testid="quiz-demo-goto-tasks"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
            >
              <ListChecks className="w-4 h-4" aria-hidden="true" />
              {t("quiz.demo.createTask")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-demo-picker">
      <p className="eyebrow">{t("quiz.eyebrow")}</p>
      <h1 className="page-title">{t("quiz.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("quiz.subtitle")}</p>
      <div className="mt-4 rounded-2xl border border-border-soft bg-card p-6 md:p-8 shadow-raised">
        <p className="text-sm font-semibold">{t("quiz.demo.pickTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-[1.6]">{t("quiz.demo.pickSubtitle")}</p>
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label={t("quiz.demo.pickTitle")}>
          {rows.map(({ material, ownerLabel }) => (
            <PickerRow key={material.id} material={material} ownerLabel={ownerLabel!} onPick={() => onPick(material.id)} />
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="w-3 h-3 flex-none" aria-hidden="true" />
          {t("quiz.retakeNote")}
        </p>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");
  const materialParam = searchParams.get("material");

  // URL truth is a synchronous repository read (the shared shell's getQuizSession
  // precedent — the local store has no async truth).
  const session = sessionParam ? getQuizSession(sessionParam) : undefined;
  const material = !sessionParam && materialParam ? getMaterial(materialParam) : undefined;

  // ONE owner lookup set, keyed by the OWNER id — identical across the launch
  // state (owner = the picked material's owner) and the session state (owner =
  // the session's own owner; AD-6 makes them the same owner). Same keys →
  // warm cache across the ?material → ?session URL flip → the shared shell
  // never unmounts mid-launch (losing its retake params would break 再来一轮).
  const ownerPlanId = session?.planId ?? material?.planId ?? null;
  const ownerTaskId = session?.taskId ?? material?.taskId ?? null;
  const planQuery = usePlanQuery(ownerPlanId ?? "");
  const planNodesQuery = usePlanNodesQuery(ownerPlanId ?? "");
  const planMaterialsQuery = usePlanMaterialsQuery(ownerPlanId ?? "");
  const taskQuery = useTaskQuery(ownerTaskId ?? "");
  const taskNodeQuery = useTaskNodeQuery(ownerTaskId ?? "");
  const taskMaterialsQuery = useTaskMaterialsQuery(ownerTaskId ?? "");

  const pending = Boolean(
    (ownerPlanId && (planQuery.isPending || planNodesQuery.isPending || planMaterialsQuery.isPending)) ||
      (ownerTaskId && (taskQuery.isPending || taskNodeQuery.isPending || taskMaterialsQuery.isPending)),
  );

  if (pending) return null;

  // -- ?session=<id>: the owner context derives from the session itself ----------
  if (sessionParam) {
    let context: QuizSessionContext;
    if (!session) {
      context = lostContext("quiz.runner.notFound");
    } else if (session.planId) {
      context = planQuery.data
        ? {
            kind: "plan",
            ownerId: session.planId,
            exists: true,
            nodes: planNodesQuery.data ?? [],
            materials: planMaterialsQuery.data ?? [],
            ...DEMO_BACK,
            notFoundKey: "plans.notFound",
          }
        : lostContext("plans.notFound");
    } else if (session.taskId) {
      context = taskQuery.data
        ? {
            kind: "task",
            ownerId: session.taskId,
            exists: true,
            nodes: taskNodeQuery.data ? [taskNodeQuery.data] : [],
            materials: taskMaterialsQuery.data ?? [],
            ...DEMO_BACK,
            notFoundKey: "tasks.notFound",
          }
        : lostContext("tasks.notFound");
    } else {
      // A session with no owner cannot run anywhere honestly — never here either.
      context = lostContext("quiz.runner.notFound");
    }
    return <QuizSessionPage context={context} />;
  }

  // -- ?material=<id>: the launch state — the picked material IS the scope -------
  if (materialParam) {
    const quizable = material ? quizableMaterials([material]).length > 0 : false;
    const ownerLabel = material
      ? material.planId && planQuery.data
        ? t("quiz.demo.fromPlan", { plan: planQuery.data.topic })
        : material.taskId && taskQuery.data
          ? t("quiz.demo.fromTask", { task: material.title })
          : null
      : null;

    if (!material || !quizable || !ownerLabel) {
      // Unknown id / nothing to quiz from / no owner — honest cards, never an invented attribution.
      return (
        <QuizSessionPage
          context={lostContext(!material ? "quiz.demo.materialNotFound" : !quizable ? "quiz.demo.notQuizable" : "quiz.demo.materialNotFound")}
        />
      );
    }

    const context: QuizSessionContext =
      material.planId && planQuery.data
        ? {
            kind: "plan",
            ownerId: planQuery.data.id,
            exists: true,
            nodes: planNodesQuery.data ?? [],
            materials: [material], // scopeLocked: the picker fixed the scope — this material only
            scopeLocked: true,
            launchHeader: <PickedMaterialStrip material={material} ownerLabel={ownerLabel} />,
            ...DEMO_BACK,
            notFoundKey: "plans.notFound",
          }
        : {
            kind: "task",
            ownerId: taskQuery.data!.id,
            exists: true,
            nodes: taskNodeQuery.data ? [taskNodeQuery.data] : [],
            materials: [material],
            scopeLocked: true,
            launchHeader: <PickedMaterialStrip material={material} ownerLabel={ownerLabel} />,
            ...DEMO_BACK,
            notFoundKey: "tasks.notFound",
          };
    return <QuizSessionPage context={context} />;
  }

  // -- no params: the material picker -------------------------------------------
  return (
    <MaterialPicker
      onPick={(materialId) => setSearchParams(new URLSearchParams({ material: materialId }))}
    />
  );
}

import { useEffect, useState } from "react";
import { Flame, Check, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { DEFAULT_TASKS, type PlannerTask } from "@/lib/demo-data";
import { useSearchParams } from "react-router-dom";
import PlannerPrototype from "@/prototype/plans-epic2";

const PRIORITY_KEYS: Record<PlannerTask["priority"], string> = {
  high: "planner.high",
  medium: "planner.medium",
  low: "planner.low",
};

const PRIORITY_CLS: Record<PlannerTask["priority"], string> = {
  high: "bg-[rgba(168,50,50,0.1)] text-danger-ink",
  medium: "bg-[hsl(var(--partial-tint))] text-partial-ink",
  low: "bg-[hsl(var(--mastered-tint))] text-mastered-ink",
};

/** PROTOTYPE gate (epic-2): /planner?variant=A|B|C renders throwaway plans-UI variants. */
export default function PlannerPage() {
  const [searchParams] = useSearchParams();
  if (searchParams.get("variant")) return <PlannerPrototype />;
  return <PlannerDemoPage />;
}

function PlannerDemoPage() {
  const { t } = useLanguage();
  const { progress, resetTick } = useUserProgress();

  // Local demo state only — completion affects today, never mastery. Reset on demo-data reset.
  const [tasks, setTasks] = useState<PlannerTask[]>(() => DEFAULT_TASKS.map(task => ({ ...task })));

  useEffect(() => {
    setTasks(DEFAULT_TASKS.map(task => ({ ...task })));
  }, [resetTick]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const done = tasks.filter(task => task.done).length;
  const total = tasks.length;
  const percent = Math.round((done / total) * 100);

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("planner.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("planner.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("planner.subtitle")}</p>
        </div>
        <span className="pill pill-streak">
          <Flame className="w-[13px] h-[13px]" aria-hidden="true" />
          {t("dashboard.streak", { n: progress.streak })}
        </span>
      </div>

      {/* Day card */}
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("planner.dayProgress")}</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t("planner.daySub", { done, total })}</p>
          </div>
          <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">{percent}%</span>
        </div>

        <div
          className="h-2 rounded-full bg-[hsl(var(--uncovered-fill))] overflow-hidden mt-3"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-gradient-to-r from-grad-a to-grad-b transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Task list */}
        <div className="flex flex-col mt-3">
          {tasks.map(task => {
            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 py-3.5 px-1 border-b border-border-soft last:border-b-0 ${task.done ? "done" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-pressed={task.done}
                  aria-label={task.done ? t("planner.markUndone") : t("planner.markDone")}
                  className={`w-[22px] h-[22px] rounded-full border-[1.5px] grid place-items-center flex-none mt-px cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    task.done
                      ? "bg-mastered border-mastered text-white"
                      : "border-[#d9cfc3] text-transparent hover:border-primary"
                  }`}
                >
                  <Check className="w-3 h-3" aria-hidden="true" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold leading-[1.45] transition-opacity ${task.done ? "line-through opacity-55" : ""}`}>
                    {t(task.key)}
                  </div>
                  <div className="flex items-center gap-[7px] flex-wrap mt-1 text-[10px] text-muted-foreground">
                    <span className={`px-2 py-[2px] rounded-full text-[9px] font-bold tracking-[0.02em] ${PRIORITY_CLS[task.priority]}`}>
                      {t(PRIORITY_KEYS[task.priority])}
                    </span>
                    <span>{t(task.metaKey)}</span>
                    {task.ai && (
                      <span className="inline-flex items-center gap-[3px] text-accent-ink font-semibold">
                        <Sparkles className="w-[11px] h-[11px]" aria-hidden="true" />
                        {t("planner.ai")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex-none flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {task.minutes} {t("common.minUnit")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak note */}
      <div className="mt-3 flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-[var(--surface-warm)] border border-[rgba(232,110,48,0.18)] text-xs text-muted-foreground">
        <Flame className="w-[18px] h-[18px] text-partial-ink flex-none" aria-hidden="true" />
        {t("planner.streakNote", { n: progress.streak })}
      </div>
    </div>
  );
}

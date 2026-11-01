import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarDays, CheckCircle2, Circle, Clock, Sparkles, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Task {
  id: number;
  title: { zh: string; en: string };
  time: { zh: string; en: string };
  completed: boolean;
  priority: "high" | "medium" | "low";
  aiSuggested?: boolean;
}

const initialTasks: Task[] = [
  { id: 1, title: { zh: "复习 HCI 第三讲笔记", en: "Review HCI Lecture 3 notes" }, time: { zh: "30 分钟", en: "30 min" }, completed: true, priority: "high" },
  { id: 2, title: { zh: "完成可用性启发式测验", en: "Complete usability heuristics quiz" }, time: { zh: "15 分钟", en: "15 min" }, completed: true, priority: "high", aiSuggested: true },
  { id: 3, title: { zh: "学习认知负荷理论", en: "Study cognitive load theory" }, time: { zh: "45 分钟", en: "45 min" }, completed: false, priority: "medium" },
  { id: 4, title: { zh: "复习薄弱点：可访问性", en: "Review weak area: accessibility" }, time: { zh: "20 分钟", en: "20 min" }, completed: false, priority: "high", aiSuggested: true },
  { id: 5, title: { zh: "制作第五章闪卡", en: "Create Chapter 5 flashcards" }, time: { zh: "25 分钟", en: "25 min" }, completed: false, priority: "medium" },
  { id: 6, title: { zh: "练习交互设计模式", en: "Practice interaction design patterns" }, time: { zh: "30 分钟", en: "30 min" }, completed: false, priority: "low" },
];

export default function PlannerPage() {
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const totalMinutes = tasks.filter(t => !t.completed).reduce((acc, t) => acc + parseInt(t.time.en), 0);

  const priorityLabels: Record<string, string> = {
    high: t("planner.priorityHigh"),
    medium: t("planner.priorityMedium"),
    low: t("planner.priorityLow"),
  };

  const priorityColors: Record<string, string> = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-amber/10 text-amber",
    low: "bg-emerald/10 text-emerald",
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <AnimatedSection>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{t("planner.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("planner.completed")} {completed}/{total} {t("planner.tasks")} · {t("planner.remaining")} {totalMinutes} {t("common.minutes")}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-all active:scale-[0.97]">
              <Sparkles className="w-3.5 h-3.5" /> {t("planner.aiPlan")}
            </button>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all active:scale-[0.97]">
              <Plus className="w-3.5 h-3.5" /> {t("planner.addTask")}
            </button>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{t("planner.todayProgress")}</span>
            <span className="text-xs font-semibold text-primary">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
        </div>
      </AnimatedSection>

      <div className="space-y-2">
        {tasks.map((task, i) => (
          <AnimatedCard key={task.id} delay={0.08 + i * 0.04}>
            <div className={cn("bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-all", task.completed && "opacity-60")}>
              <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald" /> : <Circle className="w-5 h-5 text-border hover:text-primary transition-colors" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", task.completed && "line-through")}>{task.title[language]}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {task.time[language]}
                  </span>
                  {task.aiSuggested && (
                    <span className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
                      <Sparkles className="w-3 h-3" /> {t("planner.aiSuggested")}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold", priorityColors[task.priority])}>
                {priorityLabels[task.priority]}
              </span>
            </div>
          </AnimatedCard>
        ))}
      </div>
    </div>
  );
}

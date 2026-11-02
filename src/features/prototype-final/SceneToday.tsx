/**
 * PROTOTYPE scene 6/8 — 今日学习 (Today): the aggregated daily task list —
 * not a calendar. One queue assembled from reading position, due flashcards,
 * planned quiz, and mistake retries. Completing items is checkable; starting
 * one jumps to its scene. Bottom strip: the week's evidence rhythm (computed
 * from the shared evidence array).
 */
import { BookOpen, CheckCircle2, Circle, ClipboardCheck, Flame, Layers, NotebookPen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useL, todayItems, type ProtoState } from "./demo";
import { evidenceStreak } from "@/features/plans/display-shaping";

const ICONS = {
  read: BookOpen,
  quiz: ClipboardCheck,
  cards: Layers,
  mistakes: NotebookPen,
} as const;

export default function SceneToday({ state }: { state: ProtoState }) {
  const l = useL();
  const { language } = useLanguage();
  const doneCount = todayItems.filter((i) => state.todayDone[i.id]).length;
  const totalMinutes = todayItems.filter((i) => !state.todayDone[i.id]).reduce((s, i) => s + i.minutes, 0);

  // real evidence-per-day bars for the last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = d.toDateString();
    const count = state.evidence.filter((e) => new Date(e.createdAt).toDateString() === key).length;
    return { label: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()], count };
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="p-6 md:p-8 max-w-[760px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{l("今日学习", "Today")}</p>
          <h1 className="page-title mt-1.5">
            {new Date().toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" })}
          </h1>
        </div>
        <span className="pill pill-streak">
          <Flame className="w-[13px] h-[13px]" aria-hidden="true" />
          {l(`证据连击 ${evidenceStreak(state.evidence)} 天`, `${evidenceStreak(state.evidence)}-day evidence streak`)}
        </span>
      </div>

      <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft mt-4">
        {todayItems.map((item) => {
          const done = !!state.todayDone[item.id];
          const Icon = ICONS[item.icon];
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              <button
                type="button"
                onClick={() => state.toggleToday(item.id)}
                aria-label={done ? l("标记未完成", "Mark not done") : l("标记完成", "Mark done")}
                className="text-muted-foreground hover:text-foreground cursor-pointer flex-none"
              >
                {done ? <CheckCircle2 className="w-[18px] h-[18px] text-[var(--mastered-ink)]" /> : <Circle className="w-[18px] h-[18px]" />}
              </button>
              <span className={`w-8 h-8 rounded-lg grid place-items-center flex-none ${done ? "tint-green" : "tint-coral"}`}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>{l(item.zhTitle, item.enTitle)}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{l(item.zhMeta, item.enMeta)}</p>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
                {item.minutes} {l("分钟", "min")}
              </span>
              {!done && (
                <button
                  type="button"
                  onClick={() => state.go(item.scene)}
                  className="pill pill-mastered cursor-pointer flex-none"
                >
                  {l("开始", "Start")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3 px-1">
        {l(
          `已完成 ${doneCount}/${todayItems.length} · 剩余约 ${totalMinutes} 分钟 · 队列每天按你的计划与记忆曲线自动重排`,
          `Done ${doneCount}/${todayItems.length} · ~${totalMinutes} min left · the queue re-ranks daily from your plans and memory curve`,
        )}
      </p>

      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 mt-5">
        <h2 className="eyebrow mb-3">{l("本周证据节奏", "This week's evidence rhythm")}</h2>
        <div className="flex items-end gap-2 h-20">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[var(--grad-b)] to-[var(--grad-a)] transition-all" style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count ? 6 : 2, opacity: d.count ? 1 : 0.25 }} />
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {l(
            "连击只认证据日（至少一条判分记录）——登录和阅读时长都不算。",
            "Streaks count evidence days (at least one graded record) — logins and reading minutes never do.",
          )}
        </p>
      </div>
    </div>
  );
}

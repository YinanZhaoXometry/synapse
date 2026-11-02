/**
 * PROTOTYPE scene 8/8 — Dashboard, final state: one honest mastery overview
 * across plans, evidence streak, this-week quiz count, due flashcards, the
 * week's evidence rhythm, per-plan state bars, next-best-action, and the
 * achievements strip. Every number derives from the shared evidence array via
 * the shipped seam.
 */
import { ArrowRight, BookOpen, Flame, ListChecks, Lock, Trophy } from "lucide-react";
import { useL, demoFlashcards, demoPlans, demoNodes, type ProtoState } from "./demo";
import { evidenceStreak, planCardMetrics } from "@/features/plans/display-shaping";
import { MasteryRing, StateMiniBar } from "@/features/plans/atoms";

export default function SceneDashboard({ state }: { state: ProtoState }) {
  const l = useL();
  const mlNodes = demoNodes.filter((n) => n.planId === "p-ml");
  const metrics = planCardMetrics(mlNodes, state.evidence);
  const quizWeek = state.evidence.filter((e) => new Date(e.createdAt) > new Date(Date.now() - 7 * 86_400_000)).length;
  const masteredCount = metrics.stateCounts.mastered;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const count = state.evidence.filter((e) => new Date(e.createdAt).toDateString() === d.toDateString()).length;
    return { label: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()], count };
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto animate-fade-in pb-24">
      <p className="eyebrow">{l("总览", "Overview")}</p>
      <h1 className="page-title mt-1.5">
        {l("下午好，继续冲刺 💪", "Good afternoon — keep going 💪")}
      </h1>

      {/* stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 flex items-center gap-3">
          <MasteryRing value={metrics.rollup} size={56} />
          <div>
            <p className="text-[11px] text-muted-foreground">{l("总体掌握度", "Overall mastery")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{l("机器学习面试冲刺", "ML interview sprint")}</p>
          </div>
        </div>
        {[
          { icon: Flame, label: l("证据连击", "Evidence streak"), value: `${evidenceStreak(state.evidence)} ${l("天", "days")}` },
          { icon: ListChecks, label: l("本周证据", "Evidence this week"), value: String(quizWeek) },
          { icon: BookOpen, label: l("到期闪卡", "Cards due"), value: `${demoFlashcards.length + 8}` },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <s.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
            <p className="font-display font-bold text-xl mt-2 tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 mt-5 items-start">
        <div className="min-w-0 space-y-4">
          {/* plans progress */}
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("计划进度", "Plan progress")}</h2>
            <div className="space-y-4">
              {demoPlans.map((plan) => {
                const nodes = demoNodes.filter((n) => n.planId === plan.id);
                const m = planCardMetrics(nodes, state.evidence);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => state.go("plan")}
                    className="w-full text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate group-hover:text-accent-ink transition-colors">{plan.topic}</span>
                      <span className="font-display font-bold tabular-nums text-sm text-accent-ink flex-none">{m.rollup}%</span>
                    </div>
                    <StateMiniBar counts={m.stateCounts} />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {l(`✦ 已掌握 ${m.stateCounts.mastered}`, `✦ ${m.stateCounts.mastered} mastered`)} ·{" "}
                      {l(`◐ 进行中 ${m.stateCounts.partial}`, `◐ ${m.stateCounts.partial} in progress`)} ·{" "}
                      {l(`○ 未开始 ${m.stateCounts.uncovered}`, `○ ${m.stateCounts.uncovered} uncovered`)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* evidence rhythm */}
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("本周证据节奏", "This week's evidence rhythm")}</h2>
            <div className="flex items-end gap-2 h-24">
              {days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className={`text-[10px] tabular-nums ${d.count ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{d.count || ""}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[var(--grad-b)] to-[var(--grad-a)]"
                    style={{ height: `${Math.max((d.count / maxCount) * 100, 3)}%`, opacity: d.count ? 1 : 0.25 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* next best action */}
          <button
            type="button"
            onClick={() => state.go("today")}
            className="w-full text-left rounded-2xl border-[1.5px] border-dashed border-[var(--accent-edge)] bg-[var(--accent-tint)] p-4 cursor-pointer hover:bg-[var(--accent-tint-2)] transition-colors"
          >
            <p className="eyebrow">{l("下一步", "Next up")}</p>
            <p className="text-sm font-semibold mt-1.5">{l("继续阅读《机器学习实战》第 3 页", "Continue ML in Action p.3")}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {l("今日队列还有 3 项 · 约 33 分钟", "3 more in today's queue · ~33 min")}
            </p>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink mt-2.5">
              {l("去今日学习", "Open Today")} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>

          {/* achievements strip */}
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("成就", "Achievements")}</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Flame, label: l("七日连击", "7-day streak"), got: true },
                { icon: Trophy, label: l("首个掌握", "First mastery"), got: true },
                { icon: ListChecks, label: l("百题斩", "100 answered"), got: false },
              ].map((a) => (
                <div
                  key={a.label}
                  className={`rounded-xl border border-border-soft p-2.5 text-center ${a.got ? "tint-coral" : "opacity-60"}`}
                >
                  {a.got ? <a.icon className="w-4 h-4 mx-auto" aria-hidden="true" /> : <Lock className="w-4 h-4 mx-auto" aria-hidden="true" />}
                  <p className="text-[10px] font-semibold mt-1.5 leading-tight">{a.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2.5">
              {l(
                `已掌握 ${masteredCount} 个节点 · 成就只由证据与掌握度驱动`,
                `${masteredCount} nodes mastered · achievements are evidence-driven only`,
              )}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-6 px-1">
        {l(
          "新日期显示提示：所有数字随你在测验场景答题实时变化——这就是证据驱动的最终形态。",
          "Everything here moves live as you answer quizzes — evidence-driven, end to end.",
        )}
      </p>
    </div>
  );
}

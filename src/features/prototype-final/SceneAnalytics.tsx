/**
 * PROTOTYPE scene 13/14 — Analytics (FR-26) + Quiz Hub (FR-42), Phase 2:
 * per-node mastery bars (weak first), quiz-accuracy trend, weekly evidence
 * rhythm — all REAL, computed from the shared evidence array — plus the quiz
 * history hub with retake (fresh evidence per NFR-8, never repeat-inflation).
 */
import { CalendarRange, Gauge, ListChecks, RotateCcw, Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useL, demoNodes, type ProtoState } from "./demo";
import { evidenceStreak, nodeRowViews, planCardMetrics, planRecentActivity } from "@/features/plans/display-shaping";

const VALUES = { correct: 1, partial: 0.5, wrong: 0 } as const;

export default function SceneAnalytics({ state }: { state: ProtoState }) {
  const l = useL();
  const { language } = useLanguage();
  const nodes = demoNodes.filter((n) => n.planId === "p-ml");
  const views = nodeRowViews(nodes, state.evidence);
  const metrics = planCardMetrics(nodes, state.evidence);
  const covered = metrics.stateCounts.mastered + metrics.stateCounts.partial;
  const history = planRecentActivity(nodes, state.evidence, 20);

  // per-day accuracy over the last 7 days (real evidence)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const records = state.evidence.filter((e) => nodes.some((n) => n.id === e.nodeId) && new Date(e.createdAt).toDateString() === d.toDateString());
    const acc = records.length ? Math.round((records.reduce((s, r) => s + VALUES[r.outcome], 0) / records.length) * 100) : null;
    return { d, acc, count: records.length };
  });
  const pts = days.map((x, i) => ({ x: 24 + i * 56, y: x.acc === null ? null : 96 - (x.acc / 100) * 76 }));
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto animate-fade-in pb-24">
      <p className="eyebrow">{l("数据分析 · 测验史", "Analytics · Quiz history")}</p>
      <h1 className="page-title mt-1.5">{l("机器学习面试冲刺 · 全景", "ML interview sprint · the full picture")}</h1>

      <Tabs defaultValue="analytics" className="mt-5">
        <TabsList className="bg-[var(--glass-2)]">
          <TabsTrigger value="analytics">{l("数据分析", "Analytics")}</TabsTrigger>
          <TabsTrigger value="quizzes">{l("测验历史", "Quiz Hub")} · {history.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* KPI mini-stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Gauge, label: l("总体掌握度", "Overall mastery"), value: `${metrics.rollup}%` },
              { icon: Target, label: l("已覆盖节点", "Nodes covered"), value: `${covered}/${nodes.length}` },
              { icon: ListChecks, label: l("累计证据", "Total evidence"), value: String(state.evidence.filter((e) => nodes.some((n) => n.id === e.nodeId)).length) },
              { icon: CalendarRange, label: l("证据连击", "Evidence streak"), value: `${evidenceStreak(state.evidence)} ${l("天", "d")}` },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border-soft rounded-2xl shadow-raised p-3.5">
                <s.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                <p className="font-display font-bold text-lg mt-1.5 tabular-nums">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* per-node mastery bars, weak first */}
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("节点掌握度（弱项在前）", "Mastery by node (weak first)")}</h2>
            <div className="space-y-2.5">
              {[...views]
                .sort((a, b) => a.score - b.score)
                .map((v) => (
                  <div key={v.node.id} className="flex items-center gap-3">
                    <span className="text-xs font-medium truncate w-[132px] flex-none text-right">{v.node.title}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-[var(--uncovered-fill)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          v.state === "mastered" ? "bg-[var(--mastered-tint)]" : "bg-gradient-to-r from-[var(--grad-a)] to-[var(--grad-b)]"
                        }`}
                        style={{ width: v.hasEvidence ? `${v.score}%` : "0%" }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-9 flex-none">{v.hasEvidence ? `${v.score}%` : "—"}</span>
                  </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              {l("绿条 = 已掌握（≥80 且 ≥3 条证据）；灰底 = 无证据。", "Green = mastered (≥80 AND ≥3 records); grey track = no evidence.")}
            </p>
          </div>

          {/* accuracy trend + weekly rhythm */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
              <h2 className="eyebrow mb-3">{l("答题准确率 · 7 天", "Accuracy trend · 7 days")}</h2>
              <svg viewBox="0 0 380 110" className="w-full" role="img" aria-label={l("准确率折线", "accuracy line")}>
                {[25, 50, 75, 100].map((g) => (
                  <g key={g}>
                    <line x1="24" x2="368" y1={96 - (g / 100) * 76} y2={96 - (g / 100) * 76} stroke="hsl(var(--foreground) / 0.08)" strokeDasharray="3 4" />
                    <text x="18" y={99 - (g / 100) * 76} textAnchor="end" fontSize="8" fill="hsl(var(--muted-foreground))">{g}</text>
                  </g>
                ))}
                <polyline
                  fill="none"
                  stroke="hsl(var(--grad-a))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  points={pts.filter((p) => p.y !== null).map((p) => `${p.x},${p.y}`).join(" ")}
                />
                {pts.map((p, i) =>
                  p.y === null ? null : <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="hsl(var(--card))" stroke="hsl(var(--grad-a))" strokeWidth="2" />,
                )}
                {days.map((d, i) => (
                  <text key={i} x={24 + i * 56} y="108" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">
                    {["日", "一", "二", "三", "四", "五", "六"][d.d.getDay()]}
                  </text>
                ))}
              </svg>
              <p className="text-[10px] text-muted-foreground">{l("correct=1 · partial=0.5 · wrong=0，按证据日聚合", "correct=1 · partial=0.5 · wrong=0, by evidence day")}</p>
            </div>

            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
              <h2 className="eyebrow mb-3">{l("本周证据量", "Evidence this week")}</h2>
              <div className="flex items-end gap-2 h-[110px]">
                {days.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-[9px] tabular-nums ${d.count ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{d.count || ""}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[var(--grad-b)] to-[var(--grad-a)]"
                      style={{ height: `${Math.max((d.count / maxCount) * 100, 3)}%`, opacity: d.count ? 1 : 0.25 }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{l("只统计产生证据的学习（SM-C3：不优化使用时长）", "Evidence-producing study only (SM-C3: never optimize minutes)")}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-11 h-11 rounded-xl grid place-items-center flex-none font-display font-bold tabular-nums text-sm ${h.score >= 80 ? "tint-green" : h.score >= 50 ? "tint-amber" : "tint-danger"}`}>
                  {h.score}%
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{h.nodeTitle}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {l("Mix 模式", "Mix mode")} · {h.recordCount} {l("题", "Q")} ·{" "}
                    {new Date(h.latestAt).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US")}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => state.go("quiz")}>
                  <RotateCcw className="w-3 h-3 mr-1" /> {l("重做", "Retake")}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2.5 px-1">
            {l("重做产生全新证据（NFR-8：同一题重复答对不再膨胀分数）。", "Retakes produce fresh evidence (NFR-8: repeats never inflate the score).")}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * PROTOTYPE scene 3/8 — Plan Home, final state: stage-grouped nodes with
 * honest scores + evidence popovers, fully parsed materials, every quick
 * action wired (quiz → quiz scene, flashcards/mistakes → review scene,
 * companion → reader scene), real recent activity. All numbers run the
 * shipped ADR-0001 seam over the shared evidence array.
 */
import { ArrowLeft, BookOpen, FileText, Layers, ListChecks, MessageCircle, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useL, demoMaterials, demoNodes, demoPlans, type ProtoState } from "./demo";
import { evidenceStreak, nodeRowViews, planCardMetrics, planRecentActivity, stageGroups } from "@/features/plans/display-shaping";
import { ContractNote, MasteryRing, OutcomeMark, StateGlyph, StreakChip } from "@/features/plans/atoms";

export default function ScenePlanHome({ state }: { state: ProtoState }) {
  const l = useL();
  const { language } = useLanguage();
  const plan = demoPlans[0];
  const nodes = demoNodes.filter((n) => n.planId === plan.id);
  const materials = demoMaterials.filter((m) => m.planId === plan.id);
  const metrics = planCardMetrics(nodes, state.evidence);
  const activity = planRecentActivity(nodes, state.evidence);

  const actions = [
    { icon: ListChecks, zh: "生成小测", en: "Generate quiz", zhD: "从资料出题 · 计入掌握度", enD: "From materials · counts toward mastery", go: () => state.go("quiz") },
    { icon: Layers, zh: "生成闪卡", en: "Generate flashcards", zhD: "12 张到期 · 自评排队", enD: "12 due · self-rated queue", go: () => state.go("review") },
    { icon: Upload, zh: "上传资料", en: "Attach material", zhD: "PDF / Markdown ≤ 20MB", enD: "PDF / Markdown ≤ 20MB", go: () => toast(l("原型跳过上传——计划里已有 2 份已解析资料", "Upload skipped in prototype — plan already has 2 parsed materials")) },
    { icon: MessageCircle, zh: "问学习伴侣", en: "Ask Companion", zhD: "定位到你正在读的位置", enD: "Anchored to where you're reading", go: () => state.go("reader") },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto animate-fade-in pb-24">
      <button
        type="button"
        onClick={() => state.go("plans")}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {l("返回计划列表", "Back to plans")}
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <div className="min-w-0">
          <p className="eyebrow">{l("学习计划", "Study plan")}</p>
          <h1 className="page-title mt-1.5">{plan.topic}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {l("目标", "Goal")}：{plan.goal}
          </p>
        </div>
        <div className="flex items-start gap-5">
          <StreakChip days={evidenceStreak(state.evidence)} />
          <div>
            <MasteryRing value={metrics.rollup} size={72} />
            <ContractNote>{l("各节点均分 · 未开始计 0 分 · 100% = 面试就绪", "Mean of node scores · uncovered counts 0 · 100% = ready")}</ContractNote>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-5 items-start">
        <div className="min-w-0">
          {stageGroups(nodeRowViews(nodes, state.evidence)).map((group) => (
            <section key={group.stage ?? "-"} className="mb-5">
              <h2 className="eyebrow mb-2">{group.stage ?? l("未分组", "Ungrouped")}</h2>
              <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                {group.rows.map((view) => (
                  <div key={view.node.id} className="flex items-center gap-3 px-4 py-3">
                    <StateGlyph state={view.state} />
                    <span className="text-sm font-medium truncate flex-1">{view.node.title}</span>
                    {view.node.id === "n-sup" && (
                      <button
                        type="button"
                        onClick={() => state.go("reader")}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
                      >
                        <BookOpen className="w-3 h-3" aria-hidden="true" /> {l("去阅读", "Read")}
                      </button>
                    )}
                    <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground flex-none">
                      {view.hasEvidence ? `${view.score}%` : "—"}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={l("查看证据", "View evidence")}
                          className="text-muted-foreground hover:text-foreground cursor-pointer flex-none"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-xs">
                        <p className="font-semibold mb-2">{view.node.title}</p>
                        <div className="flex items-center gap-1.5 mb-2">
                          {view.lastOutcomes.length === 0 ? (
                            <span className="text-muted-foreground">{l("暂无证据 · 完成小测后点亮", "No evidence yet — complete a quiz")}</span>
                          ) : (
                            view.lastOutcomes.map((o, i) => <OutcomeMark key={i} outcome={o} />)
                          )}
                        </div>
                        <p className="text-muted-foreground leading-[1.5]">
                          {l(
                            "分数 = 最近 5 次证据均值；掌握需 ≥80 分且 ≥3 次证据。标记「已懂」永远不计分。",
                            "Score = mean of last 5 evidence; mastered needs ≥80 AND ≥3 records. Marking as understood never counts.",
                          )}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="eyebrow">{l("资料", "Materials")}</h2>
            </div>
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
                  <span className="text-sm truncate flex-1">{m.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-none">
                    {m.kind === "pdf" ? "PDF" : "MD"}
                  </span>
                  <span className="pill pill-mastered flex-none">{l("已解析", "Parsed")}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-[1.5] text-muted-foreground mt-2 px-1">
              {l("已解析资料可用于生成测验、闪卡，并作为学习伴侣引用的出处。", "Parsed materials feed quizzes, flashcards, and Companion citations.")}
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("快捷操作", "Quick actions")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <button
                  key={a.zh}
                  type="button"
                  onClick={a.go}
                  className="text-left rounded-xl border border-border-soft p-3 hover:bg-[var(--glass-2)] transition-colors cursor-pointer"
                >
                  <a.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                  <p className="text-[13px] font-semibold mt-1.5">{l(a.zh, a.en)}</p>
                  <p className="text-[10px] text-muted-foreground">{l(a.zhD, a.enD)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{l("最近动态", "Recent activity")}</h2>
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="text-xs">
                  <p className="font-semibold leading-[1.4] truncate">{entry.nodeTitle}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {l("小测", "Quiz")} {entry.score}% · {entry.recordCount} {l("条证据", "evidence")} ·{" "}
                    {new Date(entry.latestAt).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

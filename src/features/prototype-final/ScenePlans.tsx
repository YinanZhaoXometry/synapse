/**
 * PROTOTYPE scene 2/8 — Plans Home, the front door (returning state):
 * continue hero + honest plan cards + the creation chat (live streaming demo)
 * + roadmap.sh import. Numbers come from the real mastery seam over the
 * shared evidence array.
 */
import { useState } from "react";
import { ArrowRight, GitBranch, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useL, demoPlans, demoNodes, type ProtoState } from "./demo";
import { planCardMetrics, mostRecentPlan } from "@/features/plans/display-shaping";
import { MasteryRing, StateMiniBar } from "@/features/plans/atoms";

export default function ScenePlans({ state }: { state: ProtoState }) {
  const l = useL();
  const { language } = useLanguage();
  const hero = mostRecentPlan(demoPlans);
  const heroMetrics = planCardMetrics(demoNodes.filter((n) => n.planId === hero?.id), state.evidence);

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{l("学习计划", "Study plans")}</p>
          <h1 className="page-title mt-1.5">{l("欢迎回来", "Welcome back")}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => document.getElementById("proto-create")?.scrollIntoView({ behavior: "smooth" })}>
          <Plus className="w-4 h-4 mr-1.5" /> {l("新建计划", "New plan")}
        </Button>
      </div>

      {/* continue hero */}
      {hero && (
        <button
          type="button"
          onClick={() => state.go("plan")}
          className="w-full text-left bg-card border border-border-soft rounded-2xl shadow-raised p-5 mt-4 flex items-center gap-5 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
        >
          <MasteryRing value={heroMetrics.rollup} size={64} />
          <div className="flex-1 min-w-0">
            <p className="eyebrow">
              {l("继续学习", "Continue")} · {new Date(hero.createdAt).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US")}
            </p>
            <p className="font-display font-bold text-lg leading-snug truncate mt-0.5">{hero.topic}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {l("上次：监督学习 · 第 3 页 · 62%", "Last: supervised learning · p.3 · 62%")}
            </p>
          </div>
          <span className="pill pill-mastered flex-none items-center gap-1">
            {l("继续", "Resume")} <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </span>
        </button>
      )}

      {/* plan cards */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {demoPlans.slice(1).map((plan) => {
          const metrics = planCardMetrics(demoNodes.filter((n) => n.planId === plan.id), state.evidence);
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => state.go("plan")}
              className="text-left bg-card border border-border-soft rounded-2xl shadow-raised p-4 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">{plan.topic}</p>
                <span className="font-display font-bold tabular-nums text-sm text-accent-ink flex-none">{metrics.rollup}%</span>
              </div>
              <StateMiniBar counts={metrics.stateCounts} />
              <p className="text-[11px] text-muted-foreground mt-2">
                {plan.nodeIds.length} {l("个节点", "nodes")} · 1 {l("份资料", "material")}
              </p>
            </button>
          );
        })}

        {/* creation chat teaser (final look of the in-flow generation) */}
        <CreationTeaser />
      </div>
    </div>
  );
}

/** The creation chat as a live demo: type a topic → stream → structure card. */
function CreationTeaser() {
  const l = useL();
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
  const [text, setText] = useState("");

  const STREAM = [
    "好的！「深度学习入门」我为你拆成 3 个阶段：\n\n",
    "基础 → Python/NumPy、线性代数最小集\n核心 → 全连接网络、反向传播\n应用 → 图像分类小项目\n\n",
    "共 6 个节点，按每周 5 小时大约 3 周完成。可以点击任意节点名重命名。",
  ];

  const send = () => {
    const t = topic.trim();
    if (!t || phase === "streaming") return;
    setPhase("streaming");
    setText("");
    let i = 0;
    const timer = setInterval(() => {
      if (i < STREAM.length) {
        setText((prev) => prev + STREAM[i]);
        i += 1;
      } else {
        clearInterval(timer);
        setPhase("done");
      }
    }, 700);
  };

  return (
    <div id="proto-create" className="sm:col-span-2 glass-panel rounded-2xl shadow-raised p-4">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">{l("和 AI 聊一句，10 秒得到结构化计划", "Describe a topic — get a structured plan in seconds")}</p>
          {(phase === "streaming" || phase === "done") && (
            <div className="mt-2 bg-card border border-border-soft rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.6] whitespace-pre-wrap max-w-[95%]">
              {text}
              {phase === "streaming" && <span className="animate-pulse">▋</span>}
              {phase === "done" && (
                <span className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs pointer-events-none">
                    {l("确认创建计划", "Confirm & create")}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">{l("（完整流程见已交付的 T2）", "(full flow shipped in T2)")}</span>
                </span>
              )}
            </div>
          )}
          {phase === "idle" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                l("深度学习入门", "Deep learning basics"),
                l("考研英语阅读", "Graduate English reading"),
                l("系统设计面试", "System design interviews"),
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={l("想学什么？例如「深度学习入门」", "What do you want to learn?")}
          className="h-9 text-sm"
        />
        <Button size="sm" className="h-9 px-3" onClick={send} disabled={!topic.trim() || phase === "streaming"}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2.5">
        <GitBranch className="w-3 h-3 flex-none" aria-hidden="true" />
        {l("也可以从 roadmap.sh 导入现成路线图，一键变成计划。", "Or import a ready-made roadmap from roadmap.sh as a plan.")}
      </p>
    </div>
  );
}

/**
 * PROTOTYPE scene 1/8 — final onboarding: goal → cadence → plan-first pitch.
 * The system promises a plan (structure + rhythm), never content: users bring
 * their own materials. CTA hands over to the Plans Home scene.
 */
import { useState } from "react";
import { ArrowRight, Check, Compass, GraduationCap, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useL, type ProtoState } from "./demo";

const GOALS = [
  { icon: GraduationCap, zh: "考试通关", en: "Pass an exam", zhHint: "划重点、抓考点", enHint: "Syllabus-focused" },
  { icon: Rocket, zh: "面试准备", en: "Interview prep", zhHint: "高频题、系统复习", enHint: "High-frequency drills" },
  { icon: Compass, zh: "技能提升", en: "Level up a skill", zhHint: "路线图、项目驱动", enHint: "Roadmap-driven" },
  { icon: Sparkles, zh: "兴趣探索", en: "Explore a topic", zhHint: "由浅入深", enHint: "Casual depth" },
];

const CADENCE = [
  { zh: "每周 ~3 小时", en: "~3 h / week" },
  { zh: "每周 ~5 小时", en: "~5 h / week" },
  { zh: "每周 8+ 小时", en: "8+ h / week" },
];

export default function SceneOnboarding({ state }: { state: ProtoState }) {
  const l = useL();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(1);
  const [cadence, setCadence] = useState(1);

  return (
    <div className="p-6 md:p-8 max-w-[640px] mx-auto animate-fade-in">
      <div className="flex items-center justify-center gap-1.5 mb-5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-[var(--grad-a)]" : i < step ? "w-1.5 bg-[var(--grad-b)]" : "w-1.5 bg-[var(--uncovered-fill)]"}`}
          />
        ))}
      </div>

      <div className="glass-panel rounded-2xl shadow-raised p-6 md:p-8">
        {step === 0 && (
          <div>
            <p className="eyebrow">{l("欢迎来到 Synapse", "Welcome to Synapse")}</p>
            <h1 className="page-title mt-1.5">{l("你想达成什么？", "What are you working toward?")}</h1>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-5">
              {GOALS.map((g, i) => (
                <button
                  key={g.zh}
                  type="button"
                  onClick={() => setGoal(i)}
                  className={`relative text-left rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    goal === i
                      ? "border-[var(--accent-ring)] bg-[var(--accent-tint)]"
                      : "border-border-soft bg-card hover:bg-[var(--glass-2)]"
                  }`}
                >
                  <g.icon className="w-[18px] h-[18px] text-accent-ink" aria-hidden="true" />
                  <p className="text-sm font-semibold mt-2">{l(g.zh, g.en)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{l(g.zhHint, g.enHint)}</p>
                  {goal === i && (
                    <Check className="absolute top-3 right-3 w-4 h-4 text-accent-ink" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="eyebrow">{l("节奏", "Cadence")}</p>
            <h1 className="page-title mt-1.5">{l("每周能投入多少时间？", "How much time per week?")}</h1>
            <p className="text-xs text-muted-foreground mt-2">
              {l("计划会按这个节奏拆分每天的任务量——不是日历，是一张可调整的队列。", "The plan splits daily workload to match — a queue, not a calendar.")}
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {CADENCE.map((c, i) => (
                <button
                  key={c.zh}
                  type="button"
                  onClick={() => setCadence(i)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                    cadence === i
                      ? "border-[var(--accent-ring)] bg-[var(--accent-tint)] text-accent-ink"
                      : "border-border-soft bg-card text-muted-foreground hover:bg-[var(--glass-2)]"
                  }`}
                >
                  {l(c.zh, c.en)}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="eyebrow">{l("最后一步", "Last step")}</p>
            <h1 className="page-title mt-1.5">{l("Synapse 给你计划，内容你带来", "Synapse plans it — you bring the content")}</h1>
            <div className="bg-card border border-border-soft rounded-xl p-4 mt-5 text-[13px] leading-[1.7] space-y-2">
              <p>
                <b>{l("我们将为你生成", "We'll generate")}</b>
                {l("「机器学习基础」学习计划：8 个节点、4 个阶段，按你选择的节奏排布。", " an 8-node, 4-stage ML foundations plan paced to your cadence.")}
              </p>
              <p className="text-muted-foreground">
                {l(
                  "计划只给结构与节奏。把你的教材、讲义、笔记拖进来，测验、闪卡、掌握度都从你的资料里长出来——不替你读，只帮你学会。",
                  "Plans give structure and rhythm only. Drop in your textbooks, slides and notes — quizzes, flashcards and mastery grow from your own materials. We never replace your reading; we make it stick.",
                )}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {l("上一步", "Back")}
          </Button>
          {step < 2 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              {l("下一步", "Next")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => state.go("plans")}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> {l("生成我的第一个计划", "Generate my first plan")}
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground mt-4">
        {l("已有账户？下次访问会直接回到你的计划。", "Returning? You'll land straight on your plans next visit.")}
      </p>
    </div>
  );
}

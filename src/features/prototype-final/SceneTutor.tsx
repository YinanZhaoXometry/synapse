/**
 * PROTOTYPE scene 10/14 — AI Tutor / plan-level Companion (FR-46, Phase 2):
 * grounded in the WHOLE plan's attached materials (no Reading Position),
 * answers cite Material + section, intent shortcuts follow the scaffold
 * tutor's pattern — including "analyze my mistakes" against its source section.
 */
import { useState } from "react";
import { BookOpen, GraduationCap, ListChecks, NotebookPen, PieChart, Quote, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useL, demoPlans, type ProtoState } from "./demo";

interface Msg {
  role: "user" | "companion";
  text: string;
  cite?: string;
}

const MISTAKE_ANALYSIS = {
  userZh: "帮我分析昨天那道错题：逻辑回归的损失函数",
  userEn: "Analyze yesterday's mistake: logistic regression's loss function",
  zh: "你的答案是「均方误差 (MSE)」——这是最常见的一个混淆点。回到原文（第 3 页）：交叉熵的梯度不含 Sigmoid 导数因子，错误越大梯度越充足；而 MSE 的梯度会乘上 Sigmoid 的导数，在输出接近 0 或 1 时趋近于零——错得越远反而越学不动。建议：先重读第 3 页第二段，再从错题本重练这道题，答对后「监督学习」节点的分会回来。",
  en: "Your answer was MSE — the most common mix-up here. Back to the source (p.3): cross-entropy's gradient carries no Sigmoid-derivative factor, so bigger mistakes give bigger gradients; MSE's gradient multiplies in the Sigmoid derivative, which vanishes as outputs approach 0 or 1 — the further off you are, the less it learns. Suggestion: re-read paragraph 2 on p.3, then retry this item from the Mistakes Notebook — answering correctly restores the 监督学习 node's score.",
  citeZh: "《机器学习实战》第 3 页",
  citeEn: "ML in Action, p.3",
};

export default function SceneTutor({ state }: { state: ProtoState }) {
  const l = useL();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "companion",
      text: l(
        "我在——接着整个计划的两份资料回答（不只是你正读的那一页）。想让我解释概念、出题、总结进度，或是分析你的错题？",
        "I'm here — answering from the plan's two attached materials (not just your current page). Want a concept explained, a quiz, a progress summary, or a mistake analyzed?",
      ),
    },
  ]);
  const [draft, setDraft] = useState("");

  const analyzeMistake = () => {
    setMessages((m) => [
      ...m,
      { role: "user", text: l(MISTAKE_ANALYSIS.userZh, MISTAKE_ANALYSIS.userEn) },
      { role: "companion", text: l(MISTAKE_ANALYSIS.zh, MISTAKE_ANALYSIS.en), cite: l(MISTAKE_ANALYSIS.citeZh, MISTAKE_ANALYSIS.citeEn) },
    ]);
  };

  const generic = (label: string) => {
    setMessages((m) => [
      ...m,
      { role: "user", text: label },
      {
        role: "companion",
        text: l(
          "（原型演示：真实回答由服务端 AI 生成，引用出处格式如上。）",
          "(Prototype: real answers come from server-side AI; citations render as above.)",
        ),
        cite: l("《机器学习实战》/ 面试笔记 · 相关小节", "ML in Action / notes · relevant section"),
      },
    ]);
  };

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    generic(t);
  };

  const shortcuts = [
    { icon: BookOpen, label: l("解释概念", "Explain"), run: () => generic(l("解释一个概念", "Explain a concept")) },
    { icon: ListChecks, label: l("出题检验", "Quiz me"), run: () => state.go("quiz") },
    { icon: PieChart, label: l("总结进度", "Summarize"), run: () => state.go("analytics") },
    { icon: NotebookPen, label: l("分析我的错题", "Analyze my mistakes"), run: analyzeMistake },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[760px] mx-auto animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--grad-a)] to-[var(--grad-b)] grid place-items-center flex-none">
          <GraduationCap className="w-5 h-5 text-white" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{l("AI 导师 · 计划级", "AI Tutor · plan-level")}</p>
          <h1 className="page-title mt-1 text-xl">{demoPlans[0].topic}</h1>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 ml-[52px]">
        {l(
          "已接通该计划的 2 份资料（无阅读位置）· 回答引用出处；超出资料会说「资料里没有」（NFR-1）",
          "Grounded in this plan's 2 materials (no reading position) · answers cite sources; beyond them it says so (NFR-1)",
        )}
      </p>

      <div className="glass-panel rounded-2xl shadow-raised p-4 mt-4">
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border-soft">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.run}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer"
            >
              <s.icon className="w-3 h-3" aria-hidden="true" /> {s.label}
            </button>
          ))}
        </div>

        <div className="py-4 space-y-3 max-h-[46vh] overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] text-[13px] leading-[1.65] rounded-2xl px-3.5 py-2.5 ${
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border-soft"
              }`}
            >
              <span className="whitespace-pre-wrap">{m.text}</span>
              {m.cite && (
                <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] tint-blue">
                  <Quote className="w-2.5 h-2.5" aria-hidden="true" /> {m.cite}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-3 border-t border-border-soft">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={l("问这个计划的任何事…", "Ask anything about this plan…")}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9 px-3" onClick={send} disabled={!draft.trim()}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 px-1">
        {l("试试「分析我的错题」——它会对着错题的原文出处讲，而不是泛泛而谈。", "Try 'Analyze my mistakes' — it explains against the mistake's source section, not generically.")}
      </p>
    </div>
  );
}

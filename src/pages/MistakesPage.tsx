import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { useLearningMode } from "@/contexts/LearningModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { XCircle, RefreshCw, Sparkles, BookOpen, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Mistake {
  id: number;
  question: { zh: string; en: string };
  yourAnswer: { zh: string; en: string };
  correctAnswer: { zh: string; en: string };
  topic: { zh: string; en: string };
  aiExplanation?: { zh: string; en: string };
  date: { zh: string; en: string };
}

const sampleMistakes: Mistake[] = [
  {
    id: 1,
    question: { zh: "线框图的主要目的是什么？", en: "What is the main purpose of wireframes?" },
    yourAnswer: { zh: "展示最终的视觉设计", en: "Show the final visual design" },
    correctAnswer: { zh: "勾勒页面的结构和布局", en: "Outline page structure and layout" },
    topic: { zh: "设计流程", en: "Design Process" },
    aiExplanation: { zh: "线框图是专注于结构的低保真表示，而不是视觉美化。把它们想象成蓝图——展示的是东西放在哪里，而不是它们看起来是什么样。", en: "Wireframes are low-fidelity representations focused on structure, not visual polish. Think of them as blueprints — showing where things go, not what they look like." },
    date: { zh: "3月20日", en: "Mar 20" },
  },
  {
    id: 2,
    question: { zh: "哪种评估方法涉及观察真实用户？", en: "Which evaluation method involves observing real users?" },
    yourAnswer: { zh: "启发式评估", en: "Heuristic evaluation" },
    correctAnswer: { zh: "可用性测试", en: "Usability testing" },
    topic: { zh: "评估方法", en: "Evaluation Methods" },
    aiExplanation: { zh: "启发式评估由专家根据准则进行。可用性测试则涉及实际用户在被观察的情况下执行任务。", en: "Heuristic evaluation is done by experts using guidelines. Usability testing involves real users performing tasks while being observed." },
    date: { zh: "3月19日", en: "Mar 19" },
  },
  {
    id: 3,
    question: { zh: "WCAG 代表什么？", en: "What does WCAG stand for?" },
    yourAnswer: { zh: "Web Content Accessibility Goals", en: "Web Content Accessibility Goals" },
    correctAnswer: { zh: "Web Content Accessibility Guidelines", en: "Web Content Accessibility Guidelines" },
    topic: { zh: "可访问性", en: "Accessibility" },
    aiExplanation: { zh: "WCAG 全称是 Web Content Accessibility Guidelines（网页内容可访问性指南）——注意是 Guidelines（指南）而不是 Goals（目标）。", en: "WCAG stands for Web Content Accessibility Guidelines — note it's Guidelines, not Goals. These are specific, testable standards." },
    date: { zh: "3月18日", en: "Mar 18" },
  },
];

export default function MistakesPage() {
  const { isAI } = useLearningMode();
  const { t, language } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{t("mistakes.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{sampleMistakes.length} {t("mistakes.needReview")}</p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-[0.97]">
            <RefreshCw className="w-4 h-4" /> {t("mistakes.retryAll")}
          </button>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="bg-amber/5 border border-amber/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("mistakes.weakAreas")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("mistakes.weakAreasDesc")}
              <strong>{sampleMistakes[1].topic[language]}</strong> & <strong>{sampleMistakes[2].topic[language]}</strong>
            </p>
          </div>
        </div>
      </AnimatedSection>

      <div className="space-y-4">
        {sampleMistakes.map((m, i) => (
          <AnimatedCard key={m.id} delay={0.08 + i * 0.06}>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground mb-2">{m.topic[language]}</span>
                  <p className="text-sm font-medium leading-relaxed">{m.question[language]}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{m.date[language]}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-destructive mb-0.5">{t("mistakes.yourAnswer")}</p>
                    <p className="text-xs">{m.yourAnswer[language]}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-emerald/5 border border-emerald/15 rounded-lg px-3 py-2">
                  <BookOpen className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-emerald mb-0.5">{t("mistakes.correctAnswer")}</p>
                    <p className="text-xs">{m.correctAnswer[language]}</p>
                  </div>
                </div>
              </div>
              {isAI && m.aiExplanation && (
                <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-primary mb-0.5">{t("mistakes.aiAnalysis")}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{m.aiExplanation[language]}</p>
                  </div>
                </div>
              )}
            </div>
          </AnimatedCard>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ThumbsUp, ThumbsDown, Minus, Sparkles, BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: number;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
}

const defaultCards: Record<string, Flashcard[]> = {
  zh: [
    { id: 1, front: "什么是费茨定律（Fitts's Law）？", back: "一种人体运动的预测模型，将快速移动到目标区域所需的时间与目标的距离和大小联系起来。目标越大、越近，到达越快。", difficulty: "medium" },
    { id: 2, front: "在 HCI 中如何定义「可学习性」？", back: "用户第一次接触设计时完成基本任务的容易程度。是可用性的关键组成部分。", difficulty: "easy" },
    { id: 3, front: "什么是「执行鸿沟」（Gulf of Execution）？", back: "用户意图与系统提供的可用操作之间的差距。好的设计通过使操作明显且易于访问来弥合这一鸿沟。", difficulty: "hard" },
    { id: 4, front: "解释希克定律（Hick's Law）", back: "做出决策所需的时间随选择的数量和复杂性而增加。简化选择可以减少决策时间。", difficulty: "medium" },
    { id: 5, front: "什么是心理模型（Mental Model）？", back: "用户对系统工作方式的内部表征。好的设计使系统模型与用户的心理模型保持一致，以减少困惑。", difficulty: "medium" },
  ],
  en: [
    { id: 1, front: "What is Fitts's Law?", back: "A predictive model of human movement that relates the time to move to a target with the target's distance and size. Larger, closer targets are faster to reach.", difficulty: "medium" },
    { id: 2, front: "How is 'learnability' defined in HCI?", back: "How easily users can accomplish basic tasks the first time they encounter a design. A key component of usability.", difficulty: "easy" },
    { id: 3, front: "What is the 'Gulf of Execution'?", back: "The gap between user intent and available system actions. Good design bridges this by making actions obvious and accessible.", difficulty: "hard" },
    { id: 4, front: "Explain Hick's Law", back: "Decision time increases with the number and complexity of choices. Simplifying choices reduces decision time.", difficulty: "medium" },
    { id: 5, front: "What is a Mental Model?", back: "A user's internal representation of how a system works. Good design aligns the system model with the user's mental model to reduce confusion.", difficulty: "medium" },
  ],
};

const aiGeneratedCards: Record<string, Flashcard[]> = {
  zh: [
    { id: 101, front: "什么是 WCAG？它的目标是什么？", back: "WCAG（Web Content Accessibility Guidelines）是网页内容可访问性指南，旨在让网页内容对所有人（包括残障人士）都可访问。", difficulty: "medium" },
    { id: 102, front: "Norman 的设计模型包含哪些要素？", back: "包含设计者模型（设计师的概念模型）、用户模型（用户的心理模型）和系统映像（系统呈现给用户的样子）。三者越一致，可用性越好。", difficulty: "hard" },
    { id: 103, front: "什么是渐进式披露（Progressive Disclosure）？", back: "一种交互设计策略，只在用户需要时才显示额外信息或功能，减少认知负荷，保持界面简洁。", difficulty: "easy" },
    { id: 104, front: "错误预防和错误恢复哪个更重要？", back: "错误预防更重要。Nielsen 的启发式原则强调，好的设计应该首先防止错误发生，而不是仅仅提供好的错误信息。防错优于纠错。", difficulty: "medium" },
    { id: 105, front: "什么是 A/B 测试？在 HCI 中如何应用？", back: "A/B 测试是一种比较两个版本（A 和 B）的实验方法。在 HCI 中用于比较不同设计方案的可用性指标，如完成时间、错误率和用户满意度。", difficulty: "medium" },
  ],
  en: [
    { id: 101, front: "What is WCAG and what is its goal?", back: "WCAG (Web Content Accessibility Guidelines) aims to make web content accessible to everyone, including people with disabilities.", difficulty: "medium" },
    { id: 102, front: "What are the elements of Norman's design model?", back: "Includes the Designer's Model (conceptual model), User's Model (mental model), and System Image (what the system presents). Better alignment = better usability.", difficulty: "hard" },
    { id: 103, front: "What is Progressive Disclosure?", back: "An interaction design strategy that shows additional information or features only when needed, reducing cognitive load and keeping the interface clean.", difficulty: "easy" },
    { id: 104, front: "Which is more important: error prevention or error recovery?", back: "Error prevention is more important. Nielsen's heuristics emphasize that good design should prevent errors first, rather than just providing good error messages.", difficulty: "medium" },
    { id: 105, front: "What is A/B testing? How is it used in HCI?", back: "A/B testing compares two versions (A and B) experimentally. In HCI, it's used to compare usability metrics like completion time, error rate, and user satisfaction across designs.", difficulty: "medium" },
  ],
};

export default function FlashcardsPage() {
  const { addPoints, reviewFlashcard } = useUserProgress();
  const { t, language } = useLanguage();
  const [useAiCards, setUseAiCards] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const cards = useAiCards ? (aiGeneratedCards[language] || aiGeneratedCards.zh) : (defaultCards[language] || defaultCards.zh);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card = cards[current];

  const handleGenerateFromMaterials = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setUseAiCards(true);
      setCurrent(0);
      setFlipped(false);
      setReviewed(0);
      setIsGenerating(false);
    }, 2000);
  };

  const handleRate = (rating: "easy" | "medium" | "hard") => {
    setFlipped(false);
    reviewFlashcard();
    if (rating === "easy") addPoints(5);
    else if (rating === "medium") addPoints(10);
    else addPoints(15);
    setReviewed(r => r + 1);
    setTimeout(() => {
      setCurrent(c => (c + 1) % cards.length);
    }, 200);
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <AnimatedSection>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{t("flashcards.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("flashcards.aiEnhanced")} · {t("flashcards.reviewed")} {reviewed} {t("flashcards.cards")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!useAiCards && (
              <button onClick={handleGenerateFromMaterials} disabled={isGenerating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/5 transition-all active:scale-[0.97] disabled:opacity-50">
                {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("flashcards.generating")}</> : <><BookOpen className="w-3.5 h-3.5" /> {t("flashcards.generateFromMaterials")}</>}
              </button>
            )}
            <div className="text-xs font-medium text-muted-foreground bg-secondary rounded-lg px-3 py-1.5">
              {current + 1} / {cards.length}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {useAiCards && (
        <AnimatedSection delay={0.05}>
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" /> {t("quiz.generated")}
          </div>
        </AnimatedSection>
      )}

      {/* Card */}
      <AnimatedSection delay={0.1}>
        <div className="perspective-1000 mb-6">
          <motion.div onClick={() => setFlipped(!flipped)} className="relative w-full cursor-pointer" style={{ minHeight: 280 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={flipped ? "back" : "front"}
                initial={{ opacity: 0, rotateY: flipped ? -90 : 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: flipped ? 90 : -90 }}
                transition={{ duration: 0.3 }}
                className={cn("w-full rounded-2xl border border-border p-8 flex flex-col items-center justify-center text-center", flipped ? "bg-primary/5" : "bg-card")}
                style={{ minHeight: 280 }}
              >
                {!flipped ? (
                  <>
                    <p className="text-xs font-medium text-muted-foreground mb-4">{t("common.question")}</p>
                    <p className="text-lg font-display font-semibold leading-relaxed">{card.front}</p>
                    <p className="text-xs text-muted-foreground mt-6">{t("common.clickToReveal")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-primary mb-4">{t("common.answer")}</p>
                    <p className="text-sm leading-relaxed max-w-md">{card.back}</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Rating Buttons */}
      {flipped && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-xs text-center text-muted-foreground mb-3">{t("flashcards.ratePrompt")}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => handleRate("hard")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-all active:scale-[0.97]">
              <ThumbsDown className="w-4 h-4" /> {t("flashcards.hard")}
            </button>
            <button onClick={() => handleRate("medium")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber/30 text-amber text-sm font-medium hover:bg-amber/5 transition-all active:scale-[0.97]">
              <Minus className="w-4 h-4" /> {t("flashcards.medium")}
            </button>
            <button onClick={() => handleRate("easy")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald/30 text-emerald text-sm font-medium hover:bg-emerald/5 transition-all active:scale-[0.97]">
              <ThumbsUp className="w-4 h-4" /> {t("flashcards.easy")}
            </button>
          </div>
        </motion.div>
      )}

      {/* AI Enhancement */}
      {flipped && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">{t("flashcards.aiTip")}</p>
              <p className="text-xs text-foreground/70">{t("flashcards.aiTipContent")}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

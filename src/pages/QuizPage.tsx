import { useEffect, useRef, useState } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { QuizOptionRow, type QuizOptionState } from "@/components/shared/QuizOptionRow";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Trophy, Sparkles, RotateCcw, BookOpen, Loader2, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  aiHint?: string;
}

const questionsBank: Record<string, Question[]> = {
  zh: [
    { id: 1, text: "在 HCI 中，什么是「可供性」（affordance）？", options: ["一种视觉设计模式", "暗示物体使用方式的属性", "系统性能的衡量标准", "一种用户错误类型"], correct: 1, explanation: "可供性是物体属性与使用者能力之间的关系，它决定了物体可以如何被使用。", aiHint: "想想门把手自然地告诉你该怎么使用它。" },
    { id: 2, text: "Nielsen 的哪条启发式原则涉及让用户了解系统状态？", options: ["错误预防", "系统状态可见性", "识别优于回忆", "美观与简约设计"], correct: 1, explanation: "系统状态可见性：设计应始终通过适当的反馈，在合理时间内让用户了解系统的当前状态。", aiHint: "想想加载动画对用户体验有什么作用。" },
    { id: 3, text: "在用户体验设计中，「认知负荷」指的是什么？", options: ["应用程序的运行速度", "使用界面所需的心理负担", "网站的页面数量", "界面的配色方案"], correct: 1, explanation: "认知负荷是指工作记忆中所使用的心理努力量。好的用户体验设计应最小化不必要的认知负荷。", aiHint: "想想当一个表单要求你填写太多信息时的感受。" },
    { id: 4, text: "以用户为中心的设计的主要目标是什么？", options: ["最小化开发成本", "在设计过程中聚焦用户需求", "使用最新技术", "最大化功能数量"], correct: 1, explanation: "以用户为中心的设计是一个迭代设计过程，在设计的每个阶段都聚焦于用户及其需求。", aiHint: "线索就在名字里——谁应该在中心？" },
  ],
  en: [
    { id: 1, text: "What is 'affordance' in HCI?", options: ["A visual design pattern", "A property suggesting how an object can be used", "A system performance metric", "A type of user error"], correct: 1, explanation: "Affordance is the relationship between object properties and user capabilities, determining how the object can be used.", aiHint: "Think about how a door handle naturally tells you how to use it." },
    { id: 2, text: "Which Nielsen heuristic involves keeping users informed about system status?", options: ["Error prevention", "Visibility of system status", "Recognition over recall", "Aesthetic and minimalist design"], correct: 1, explanation: "Visibility of system status: The design should always keep users informed through appropriate feedback within reasonable time.", aiHint: "Think about what loading spinners do for user experience." },
    { id: 3, text: "What does 'cognitive load' refer to in UX design?", options: ["Application speed", "Mental effort needed to use an interface", "Number of pages on a website", "The color scheme of an interface"], correct: 1, explanation: "Cognitive load is the amount of mental effort used in working memory. Good UX design minimizes unnecessary cognitive load.", aiHint: "Think about how you feel when a form asks for too much information." },
    { id: 4, text: "What is the main goal of user-centered design?", options: ["Minimize development cost", "Focus on user needs throughout the design process", "Use the latest technology", "Maximize feature count"], correct: 1, explanation: "User-centered design is an iterative process that focuses on users and their needs at every stage of the design process.", aiHint: "The clue is in the name — who should be at the center?" },
  ],
};

// AI-generated questions from "uploaded materials"
const aiGeneratedQuestions: Record<string, Question[]> = {
  zh: [
    { id: 101, text: "费茨定律（Fitts's Law）主要描述的是什么？", options: ["颜色对情绪的影响", "目标大小和距离对移动时间的影响", "文字可读性原则", "动画帧率优化"], correct: 1, explanation: "费茨定律预测快速移动到目标区域所需的时间，取决于目标的距离和大小。目标越大越近，到达越快。", aiHint: "想想为什么手机上的重要按钮通常做得比较大。" },
    { id: 102, text: "希克定律（Hick's Law）与什么有关？", options: ["屏幕亮度调节", "选择数量对决策时间的影响", "触摸屏精度", "字体渲染技术"], correct: 1, explanation: "希克定律指出，做出决策所需的时间随选择的数量和复杂性而增加。好的设计应简化选择。", aiHint: "想想餐厅菜单太长时你点餐会更慢。" },
    { id: 103, text: "「执行鸿沟」（Gulf of Execution）指的是什么？", options: ["代码编译错误", "用户意图与系统可用操作之间的差距", "网络延迟问题", "数据库查询优化"], correct: 1, explanation: "执行鸿沟是用户想做的事与系统允许他们做的事之间的差距。好的设计让操作明显且易于发现。", aiHint: "想想你第一次用一个复杂软件时找不到需要的功能的经历。" },
    { id: 104, text: "根据认知负荷理论，以下哪种做法最好？", options: ["在页面上显示尽可能多的信息", "将复杂任务分解为小步骤", "使用大量动画吸引注意力", "要求用户记住前几页的内容"], correct: 1, explanation: "认知负荷理论建议将复杂任务分解为更小的步骤，减少工作记忆的负担，提升用户体验。", aiHint: "想想为什么好的表单通常分成多个步骤。" },
  ],
  en: [
    { id: 101, text: "What does Fitts's Law primarily describe?", options: ["Color's effect on mood", "How target size and distance affect movement time", "Text readability principles", "Animation frame rate optimization"], correct: 1, explanation: "Fitts's Law predicts the time to move to a target area based on distance and size. Larger, closer targets are faster to reach.", aiHint: "Think about why important buttons on phones are usually bigger." },
    { id: 102, text: "What is Hick's Law related to?", options: ["Screen brightness adjustment", "How number of choices affects decision time", "Touchscreen accuracy", "Font rendering technology"], correct: 1, explanation: "Hick's Law states that decision time increases with the number and complexity of choices. Good design simplifies choices.", aiHint: "Think about how a long restaurant menu slows down ordering." },
    { id: 103, text: "What is the 'Gulf of Execution'?", options: ["A code compilation error", "The gap between user intent and available system actions", "A network latency issue", "Database query optimization"], correct: 1, explanation: "The Gulf of Execution is the gap between what users want to do and what the system lets them do. Good design makes actions obvious and discoverable.", aiHint: "Think about the first time you couldn't find a feature in complex software." },
    { id: 104, text: "According to Cognitive Load Theory, which approach is best?", options: ["Show as much info as possible on a page", "Break complex tasks into smaller steps", "Use lots of animations to attract attention", "Require users to remember content from previous pages"], correct: 1, explanation: "Cognitive Load Theory suggests breaking complex tasks into smaller steps to reduce working memory burden and improve user experience.", aiHint: "Think about why good forms are usually split into multiple steps." },
  ],
};

type QuizState = "start" | "playing" | "result";

export default function QuizPage() {
  const { addPoints, recordAnswer, completeQuiz } = useUserProgress();
  const { t, language } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<QuizState>("start");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [useAiGenerated, setUseAiGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const questions = useAiGenerated ? (aiGeneratedQuestions[language] || aiGeneratedQuestions.zh) : (questionsBank[language] || questionsBank.zh);
  const question = questions[current];
  const total = questions.length;

  const handleGenerateFromMaterials = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setUseAiGenerated(true);
      setIsGenerating(false);
    }, 2000);
  };

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
  };

  const handleReveal = () => {
    if (selected === null) return;
    setRevealed(true);
    const correct = selected === question.correct;
    if (correct) setScore(s => s + 1);
    recordAnswer(correct);
    setAnswers(prev => [...prev, selected]);
  };

  const handleNext = () => {
    if (current < total - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
      setShowHint(false);
    } else {
      completeQuiz();
      addPoints(score * 25);
      setState("result");
    }
  };

  const handleRestart = () => {
    setState("start");
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setScore(0);
    setAnswers([]);
    setUseAiGenerated(false);
  };

  const handleExit = () => {
    if (window.confirm(t("quiz.exitConfirm"))) {
      handleRestart();
    }
  };

  useEffect(() => {
    if (state !== "playing") return;
    questionRef.current?.focus();
  }, [state, current]);

  useEffect(() => {
    if (state !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        if (idx < question.options.length) {
          e.preventDefault();
          handleSelect(idx);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (revealed) handleNext();
        else handleReveal();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (state === "start") {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <AnimatedSection>
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <h1 className="page-title mb-2">{t("quiz.title")}</h1>
            <p className="text-muted-foreground text-sm mb-1">{total} {t("quiz.questionCount")} · {t("quiz.multipleChoice")}</p>
            <p className="text-muted-foreground text-xs mb-6">
              {t("quiz.aiHints")}
            </p>

            {useAiGenerated && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium mb-4">
                <Sparkles className="w-3.5 h-3.5" /> {t("quiz.generated")}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setState("playing")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-hero text-white shadow-brand font-medium text-sm hover:shadow-brand-hover hover:brightness-[1.03] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t("quiz.start")} <ArrowRight className="w-4 h-4" />
              </button>
              {!useAiGenerated && (
                <button
                  onClick={handleGenerateFromMaterials}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-primary/30 text-primary font-medium text-sm hover:bg-primary/5 transition-all active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t("quiz.generating")}</>
                  ) : (
                    <><BookOpen className="w-4 h-4" /> {t("quiz.generateFromMaterials")}</>
                  )}
                </button>
              )}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{t("quiz.keyboardHint")}</p>
          </div>
        </AnimatedSection>
      </div>
    );
  }

  if (state === "result") {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <AnimatedSection>
          <div className="text-center py-12">
            {pct === 100 && (
              <motion.div
                initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-6xl mb-4"
                aria-hidden="true"
              >
                🎉
              </motion.div>
            )}
            <h2 className="page-title mb-1">{t("quiz.complete")}</h2>
            <p className="mastery-number text-3xl text-primary my-3">{score}/{total}</p>
            <p className="text-muted-foreground text-sm mb-2">{t("quiz.correctRate")} {pct}% · {t("quiz.earned")} +{score * 25} {t("common.points")}</p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={handleRestart} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card font-medium text-sm hover:bg-secondary transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <RotateCcw className="w-4 h-4" /> {t("quiz.restart")}
              </button>
            </div>
          </div>
        </AnimatedSection>
      </div>
    );
  }

  const wasCorrect = revealed && selected === question.correct;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <AnimatedSection>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{t("quiz.questionOf", { current: current + 1, total })}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-primary">{t("quiz.correctCount", { count: score })}</span>
            <button
              onClick={handleExit}
              aria-label={t("quiz.exit")}
              title={t("quiz.exit")}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-8" role="progressbar" aria-valuenow={current + (revealed ? 1 : 0)} aria-valuemin={0} aria-valuemax={total}>
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((current + (revealed ? 1 : 0)) / total) * 100}%` }} transition={reduceMotion ? { duration: 0 } : { duration: 0.3 }} />
        </div>
      </AnimatedSection>

      <div aria-live="polite" className="sr-only">
        {revealed && (wasCorrect ? t("quiz.verdictCorrect") : t("quiz.verdictWrong"))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <h2 ref={questionRef} tabIndex={-1} className="text-lg font-display font-semibold mb-6 leading-relaxed focus:outline-none">{question.text}</h2>

          <div className="space-y-3 mb-6" role="radiogroup" aria-label={question.text}>
            {question.options.map((opt, i) => {
              const isCorrect = i === question.correct;
              const isSelected = i === selected;
              let optionState: QuizOptionState = "idle";
              if (revealed) {
                if (isCorrect) optionState = "correct";
                else if (isSelected) optionState = "wrong";
              } else if (isSelected) {
                optionState = "selected";
              }
              return (
                <QuizOptionRow
                  key={i}
                  index={i}
                  text={opt}
                  state={optionState}
                  disabled={revealed}
                  onClick={() => handleSelect(i)}
                  className={revealed && !isCorrect && !isSelected ? "opacity-50" : undefined}
                />
              );
            })}
          </div>

          {!revealed && (
            <AnimatePresence>
              {showHint ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-4"
                >
                  <div className="flex items-start gap-2.5 bg-citation-tint border border-primary/20 rounded-lg px-4 py-3">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="chat-body text-foreground/80">{question.aiHint}</p>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowHint(true)}
                  className="inline-flex items-center gap-1.5 rounded-sm px-1 text-xs text-primary font-medium mb-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {t("quiz.getHint")}
                </button>
              )}
            </AnimatePresence>
          )}

          {revealed && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className={`rounded-lg border-l-2 bg-secondary/60 px-4 py-3 ${wasCorrect ? "border-l-mastered" : "border-l-destructive"}`}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {wasCorrect ? t("quiz.verdictCorrect") : t("quiz.verdictWrong")} · {t("quiz.explanation")}
                </p>
                <p className="text-sm">{question.explanation}</p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-end gap-3">
            {!revealed ? (
              <button onClick={handleReveal} disabled={selected === null} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40 hover:opacity-90 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {t("quiz.checkAnswer")}
              </button>
            ) : (
              <button onClick={handleNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {current < total - 1 ? t("quiz.next") : t("quiz.viewResult")} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

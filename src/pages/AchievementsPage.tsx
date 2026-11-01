import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { Trophy, Star, Flame, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AchievementsPage() {
  const { progress } = useUserProgress();
  const { t } = useLanguage();

  const allAchievements = [
    { id: "first-quiz", title: t("achievement.firstQuiz"), description: t("achievement.firstQuizDesc"), icon: "🎯", category: "quizzes" },
    { id: "streak-3", title: t("achievement.streak3"), description: t("achievement.streak3Desc"), icon: "🔥", category: "streaks" },
    { id: "streak-7", title: t("achievement.streak7"), description: t("achievement.streak7Desc"), icon: "⚡", category: "streaks" },
    { id: "flashcard-50", title: t("achievement.flashcard50"), description: t("achievement.flashcard50Desc"), icon: "🃏", category: "flashcards" },
    { id: "perfect-quiz", title: t("achievement.perfectQuiz"), description: t("achievement.perfectQuizDesc"), icon: "💯", category: "quizzes" },
    { id: "streak-14", title: t("achievement.streak14"), description: t("achievement.streak14Desc"), icon: "🏆", category: "streaks" },
    { id: "flashcard-200", title: t("achievement.flashcard200"), description: t("achievement.flashcard200Desc"), icon: "🧠", category: "flashcards" },
    { id: "materials-10", title: t("achievement.materials10"), description: t("achievement.materials10Desc"), icon: "📚", category: "materials" },
    { id: "level-10", title: t("achievement.level10"), description: t("achievement.level10Desc"), icon: "🎓", category: "progress" },
    { id: "study-1000", title: t("achievement.study1000"), description: t("achievement.study1000Desc"), icon: "⏰", category: "progress" },
    { id: "accuracy-90", title: t("achievement.accuracy90"), description: t("achievement.accuracy90Desc"), icon: "✨", category: "quizzes" },
    { id: "all-topics", title: t("achievement.allTopics"), description: t("achievement.allTopicsDesc"), icon: "🌟", category: "materials" },
  ];

  const unlockedIds = new Set(progress.achievements.map(a => a.id));
  const unlockedCount = progress.achievements.length;
  const totalCount = allAchievements.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <AnimatedSection>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">{t("achievements.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("achievements.unlocked")} {unlockedCount}/{totalCount}</p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing progress={pct} size={64} strokeWidth={5}>
              <span className="text-sm font-display font-bold mastery-number">{pct}%</span>
            </ProgressRing>
            <div>
              <p className="text-2xl font-display font-bold mastery-number">{progress.points}</p>
              <p className="text-xs text-muted-foreground">{t("achievements.totalPoints")}</p>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Flame className="w-5 h-5 text-partial mx-auto mb-1" />
            <p className="text-xl font-display font-bold mastery-number">{progress.streak}</p>
            <p className="text-xs text-muted-foreground">{t("achievements.streakDays")}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Star className="w-5 h-5 text-partial mx-auto mb-1" />
            <p className="text-xl font-display font-bold mastery-number">{progress.level}</p>
            <p className="text-xs text-muted-foreground">{t("achievements.currentLevel")}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-display font-bold mastery-number">{unlockedCount}</p>
            <p className="text-xs text-muted-foreground">{t("achievements.badges")}</p>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allAchievements.map((a, i) => {
            const unlocked = unlockedIds.has(a.id);
            return (
              <AnimatedCard key={a.id} delay={0.1 + i * 0.04}>
                <div className={cn("bg-card border rounded-xl p-4 transition-all", unlocked ? "border-partial/30" : "border-border opacity-60")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", unlocked ? "bg-partial-tint" : "bg-secondary")}>
                      {unlocked ? a.icon : <Lock className="w-5 h-5 text-muted-foreground/50" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      {unlocked && <p className="text-[10px] text-partial font-medium mt-1">{t("achievements.unlockedLabel")}</p>}
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            );
          })}
        </div>
      </AnimatedSection>
    </div>
  );
}

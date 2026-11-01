import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { StatCard } from "@/components/shared/StatCard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Target, BookOpen, Brain, HelpCircle, Trophy, ArrowRight, Sparkles, TrendingUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const achievementKeyById: Record<string, string> = {
  "first-quiz": "achievement.firstQuiz",
  "streak-3": "achievement.streak3",
  "streak-7": "achievement.streak7",
  "flashcard-50": "achievement.flashcard50",
};

export default function DashboardPage() {
  const { progress } = useUserProgress();
  const { t } = useLanguage();

  const accuracy = progress.totalAnswers > 0 ? Math.round((progress.correctAnswers / progress.totalAnswers) * 100) : 0;
  const weeklyPct = Math.round((progress.weeklyProgress / progress.weeklyGoal) * 100);

  const quickActions = [
    { to: "/quiz", icon: HelpCircle, label: t("dashboard.startQuiz"), desc: t("dashboard.startQuizDesc"), color: "bg-primary/10 text-primary" },
    { to: "/flashcards", icon: Brain, label: t("dashboard.flashcardReview"), desc: t("dashboard.flashcardReviewDesc"), color: "bg-amber/10 text-amber" },
    { to: "/materials", icon: BookOpen, label: t("dashboard.studyMaterials"), desc: t("dashboard.studyMaterialsDesc"), color: "bg-emerald/10 text-emerald" },
    { to: "/ai-tutor", icon: Sparkles, label: t("dashboard.aiTutor"), desc: t("dashboard.aiTutorDesc"), color: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <AnimatedSection>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="page-title md:text-3xl leading-tight">{t("dashboard.welcome")}</h1>
            <p className="text-muted-foreground mt-1">{t("dashboard.aiReady")}</p>
          </div>
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div tabIndex={0} role="button" aria-label={t("dashboard.streakRule")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-partial-tint cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Flame className="w-4 h-4 text-partial" />
                  <span className="text-sm font-semibold text-partial">{t("dashboard.streak")} {progress.streak} {t("common.days")}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56 text-center">{t("dashboard.streakRule")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Target className="w-4 h-4" />} iconClassName="bg-primary/10 text-primary" label={t("dashboard.weeklyGoal")} value={`${weeklyPct}%`} hint={`${progress.weeklyProgress}/${progress.weeklyGoal} ${t("common.minutes")}`} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} iconClassName="bg-mastered-tint text-mastered" label={t("dashboard.accuracy")} value={`${accuracy}%`} hint={`${progress.correctAnswers}/${progress.totalAnswers} ${t("dashboard.correct")}`} />
          <StatCard icon={<Clock className="w-4 h-4" />} iconClassName="bg-partial-tint text-partial" label={t("dashboard.studyTime")} value={`${Math.round(progress.studyMinutes / 60)}${t("common.hours")}`} hint={`${t("dashboard.cumulative")} ${progress.studyMinutes} ${t("common.minutes")}`} />
          <StatCard icon={<Trophy className="w-4 h-4" />} iconClassName="bg-primary/10 text-primary" label={t("common.level")} value={progress.level.toString()} hint={`${progress.points} ${t("common.points")}`} />
        </div>
      </AnimatedSection>

      <div className="grid lg:grid-cols-5 gap-6">
        <AnimatedSection delay={0.1} className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center text-center">
            <h3 className="font-display font-semibold text-sm text-muted-foreground mb-4">{t("dashboard.weeklyProgress")}</h3>
            <ProgressRing progress={weeklyPct} size={140} strokeWidth={10}>
              <div className="text-center">
                <span className="mastery-number text-3xl">{weeklyPct}%</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("dashboard.goalCompletion")}</p>
              </div>
            </ProgressRing>
            <p className="text-sm text-muted-foreground mt-4">{progress.weeklyGoal - progress.weeklyProgress} {t("common.minutes")} {t("dashboard.remaining")}</p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.15} className="lg:col-span-3">
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-muted-foreground px-1">{t("dashboard.quickActions")}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {quickActions.map((action, i) => {
                return (
                  <AnimatedCard key={action.to} delay={0.15 + i * 0.06}>
                    <Link to={action.to} className="group block bg-card rounded-xl border border-border p-4 transition-shadow hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}><action.icon className="w-5 h-5" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{action.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all mt-0.5" />
                      </div>
                    </Link>
                  </AnimatedCard>
                );
              })}
            </div>
          </div>
        </AnimatedSection>
      </div>

      <AnimatedSection delay={0.2}>
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground">{t("dashboard.recentAchievements")}</h3>
            <Link to="/achievements" className="text-xs text-primary font-medium hover:underline">{t("dashboard.viewAll")}</Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {progress.achievements.slice(-4).map((a, i) => {
              const key = achievementKeyById[a.id];
              return (
                <AnimatedCard key={a.id} delay={0.2 + i * 0.08}>
                  <div className="flex items-center gap-2.5 bg-secondary/60 rounded-lg px-3.5 py-2.5">
                    <span className="text-xl">{a.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{key ? t(key) : a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{key ? t(`${key}Desc`) : a.description}</p>
                    </div>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}

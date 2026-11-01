import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { useLearningMode } from "@/contexts/LearningModeContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, Sparkles, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { mode, setMode, isAI } = useLearningMode();
  const { progress } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <AnimatedSection>
        <h1 className="text-2xl font-display font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><User className="w-4 h-4" /> {t("settings.profile")}</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-xl">
              {language === "zh" ? "学" : "S"}
            </div>
            <div>
              <p className="font-medium">{t("common.student")}</p>
              <p className="text-sm text-muted-foreground">{t("common.level")} {progress.level} · {progress.points} {t("common.points")}</p>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Language */}
      <AnimatedSection delay={0.08}>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><Globe className="w-4 h-4" /> {t("settings.language")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.languageDesc")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage("zh")}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.97]",
                language === "zh" ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
              )}
            >
              中文
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.97]",
                language === "en" ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
              )}
            >
              English
            </button>
          </div>
        </div>
      </AnimatedSection>

      {/* Learning Mode */}
      <AnimatedSection delay={0.1}>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> {t("settings.learningMode")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.learningModeDesc")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setMode("ai")}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.97]",
                isAI ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
              )}
            >
              <Sparkles className="w-4 h-4 mx-auto mb-1" />
              {t("common.aiMode")}
            </button>
            <button
              onClick={() => setMode("non-ai")}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.97]",
                !isAI ? "border-foreground bg-foreground/5 ring-2 ring-foreground/20" : "border-border hover:border-foreground/30"
              )}
            >
              <Zap className="w-4 h-4 mx-auto mb-1" />
              {t("common.manualMode")}
            </button>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}

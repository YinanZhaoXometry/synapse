import { useState } from "react";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Sparkles, Zap, ArrowRight, BookOpen, Target, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLearningMode } from "@/contexts/LearningModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Step = "welcome" | "mode" | "goals" | "ready";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const { setMode } = useLearningMode();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const goals = [
    { id: "exams", label: t("onboarding.goalExams"), icon: Target },
    { id: "understand", label: t("onboarding.goalUnderstand"), icon: Brain },
    { id: "revise", label: t("onboarding.goalRevise"), icon: BookOpen },
    { id: "practice", label: t("onboarding.goalPractice"), icon: Sparkles },
  ];

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {step === "welcome" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-2">{t("onboarding.welcome")}</h1>
            <p className="text-muted-foreground mb-8">{t("onboarding.subtitle")}</p>
            <button onClick={() => setStep("mode")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all active:scale-[0.97]">
              {t("onboarding.start")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "mode" && (
          <div>
            <h2 className="text-xl font-display font-bold text-center mb-2">{t("onboarding.chooseMode")}</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">{t("onboarding.chooseModeDesc")}</p>
            <div className="space-y-3 mb-8">
              <button onClick={() => { setMode("ai"); setStep("goals"); }} className="w-full text-left bg-card border-2 border-primary/30 rounded-xl p-5 hover:border-primary/60 transition-all active:scale-[0.98] group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">{t("onboarding.aiTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("onboarding.aiDesc")}</p>
                  </div>
                </div>
              </button>
              <button onClick={() => { setMode("non-ai"); setStep("goals"); }} className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-foreground/20 transition-all active:scale-[0.98]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Zap className="w-5 h-5 text-foreground" /></div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">{t("onboarding.manualTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("onboarding.manualDesc")}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "goals" && (
          <div>
            <h2 className="text-xl font-display font-bold text-center mb-2">{t("onboarding.goalsTitle")}</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">{t("onboarding.goalsDesc")}</p>
            <div className="space-y-2 mb-8">
              {goals.map(g => (
                <button key={g.id} onClick={() => toggleGoal(g.id)} className={cn("w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.98]", selectedGoals.includes(g.id) ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/30")}>
                  <div className="flex items-center gap-3">
                    <g.icon className={cn("w-5 h-5", selectedGoals.includes(g.id) ? "text-primary" : "text-muted-foreground")} />
                    {g.label}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("ready")} disabled={selectedGoals.length === 0} className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.97]">
              {t("common.continue")}
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="text-center">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="text-5xl mb-4">🎉</motion.div>
            <h2 className="text-xl font-display font-bold mb-2">{t("onboarding.ready")}</h2>
            <p className="text-sm text-muted-foreground mb-8">{t("onboarding.readyDesc")}</p>
            <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all active:scale-[0.97]">
              {t("onboarding.goDashboard")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

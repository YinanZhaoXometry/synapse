import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Globe,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { PLANS_HOME_ROUTE } from "@/features/plans/entry-decision";
import { cn } from "@/lib/utils";

type GoalId = "exam" | "understand" | "revise" | "practice";

const GOAL_ITEMS: Array<{ id: GoalId; titleKey: string; descKey: string; icon: typeof Target }> = [
  { id: "exam", titleKey: "onboarding.goalExam", descKey: "onboarding.goalExamDesc", icon: Target },
  { id: "understand", titleKey: "onboarding.goalUnderstand", descKey: "onboarding.goalUnderstandDesc", icon: BookOpen },
  { id: "revise", titleKey: "onboarding.goalRevise", descKey: "onboarding.goalReviseDesc", icon: RefreshCw },
  { id: "practice", titleKey: "onboarding.goalPractice", descKey: "onboarding.goalPracticeDesc", icon: HelpCircle },
];

const PRIMARY_CTA =
  "inline-flex items-center justify-center gap-2 min-w-[140px] rounded-xl bg-gradient-hero text-white shadow-brand px-5 py-3 text-sm font-semibold transition-all " +
  "hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const GHOST_BTN =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors " +
  "hover:bg-[var(--glass-4)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function OnboardingPage() {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<GoalId[]>([]);

  const toggleGoal = (id: GoalId) => {
    setGoals(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]));
  };

  const mark = (icon: "spark" | "check") => (
    <div
      aria-hidden="true"
      className="w-[52px] h-[52px] rounded-2xl bg-gradient-hero shadow-brand grid place-items-center mx-auto mb-6"
    >
      {icon === "spark" ? <Sparkles className="w-[25px] h-[25px] text-white" /> : <Check className="w-[25px] h-[25px] text-white" />}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Top row: brand + language toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="w-8 h-8 rounded-[9px] bg-gradient-hero shadow-brand grid place-items-center text-white">
              <Star className="w-4 h-4" />
            </span>
            <span className="font-display font-bold text-lg tracking-tight">Synapse</span>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={t("common.switchLang")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-[var(--glass-4)] px-3 py-[7px] text-xs font-semibold text-muted-foreground",
              "hover:bg-[var(--glass-solid)] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            {t("common.langName")}
          </button>
        </div>

        {/* Card */}
        <div
          className="border rounded-[20px] shadow-raised p-6 md:p-10"
          style={{
            background: "var(--glass-4)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            backdropFilter: "blur(24px) saturate(180%)",
            borderColor: "var(--glass-edge)",
          }}
        >
          <div className="flex gap-1.5 mb-6" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className={cn("step-dot", i <= step && "on")} />
            ))}
          </div>
          <p className="sr-only">{t("onboarding.step", { n: step + 1 })}</p>

          {step === 0 && (
            <div>
              {mark("spark")}
              <p className="eyebrow text-center">{t("onboarding.welcomeEyebrow")}</p>
              <h1 className="font-display font-semibold text-[30px] md:text-[38px] text-center leading-[1.16] tracking-[-0.03em] mt-1.5">{t("onboarding.welcomeTitle")}</h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed text-center mt-3">{t("onboarding.welcomeBody")}</p>
              <div className="flex items-center gap-3 flex-wrap mt-8">
                <button type="button" className={PRIMARY_CTA} onClick={() => setStep(1)}>
                  {t("onboarding.start")}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("common.skip")}
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="eyebrow text-center">{t("onboarding.goalEyebrow")}</p>
              <h1 className="font-display font-semibold text-[30px] md:text-[38px] text-center leading-[1.16] tracking-[-0.03em] mt-1.5">{t("onboarding.goalTitle")}</h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed text-center mt-3">{t("onboarding.goalBody")}</p>
              <div className="flex flex-col gap-2 mt-6">
                {GOAL_ITEMS.map(g => {
                  const on = goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGoal(g.id)}
                      aria-pressed={on}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-all",
                        "hover:border-[color:var(--accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on
                          ? "border-primary shadow-[0_0_0_3px_var(--accent-ring)] bg-[var(--accent-tint)]"
                          : "border-border"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="w-9 h-9 rounded-[11px] bg-[var(--surface-warm)] text-accent-ink grid place-items-center shrink-0"
                      >
                        <g.icon className="w-[19px] h-[19px]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold">{t(g.titleKey)}</span>
                        <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{t(g.descKey)}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "w-5 h-5 rounded-full border-[1.5px] grid place-items-center shrink-0 transition-colors",
                          on ? "bg-primary border-primary text-white" : "border-border text-transparent"
                        )}
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-8">
                <button type="button" className={GHOST_BTN} onClick={() => setStep(0)}>
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  {t("common.back")}
                </button>
                <button type="button" className={PRIMARY_CTA} disabled={goals.length === 0} onClick={() => setStep(2)}>
                  {t("common.continue")}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {goals.length === 0 && <span className="text-xs text-muted-foreground">{t("onboarding.pickOne")}</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {mark("check")}
              <p className="eyebrow text-center">{t("onboarding.readyEyebrow")}</p>
              <h1 className="font-display font-semibold text-[30px] md:text-[38px] text-center leading-[1.16] tracking-[-0.03em] mt-1.5">{t("onboarding.readyTitle")}</h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed text-center mt-3">{t("onboarding.readyBody")}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {goals.map(id => {
                  const item = GOAL_ITEMS.find(g => g.id === id);
                  return <span key={id} className="pill">{item ? t(item.titleKey) : id}</span>;
                })}
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-8">
                <button
                  type="button"
                  className={PRIMARY_CTA}
                  onClick={() => navigate(PLANS_HOME_ROUTE)}
                >
                  {t("onboarding.enter")}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// Northstar settings pattern (docs/design/northstar-import/IMPORT.md §1):
// grouped card + uppercase group header + label/help rows with a right control.
export default function SettingsPage() {
  const { progress } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <AnimatedSection>
        <h1 className="page-title">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </AnimatedSection>

      {/* Profile */}
      <AnimatedSection delay={0.05}>
        <section className="bg-card border border-border rounded-xl shadow-raised overflow-hidden">
          <h2 className="text-xs font-body font-semibold uppercase tracking-[0.06em] text-muted-foreground px-6 pt-5">
            {t("settings.profile")}
          </h2>
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="w-14 h-14 rounded-full bg-gradient-hero shadow-brand flex items-center justify-center font-display font-bold text-white text-xl">
              {language === "zh" ? "学" : "S"}
            </div>
            <div>
              <p className="font-medium">{t("common.student")}</p>
              <p className="text-sm text-muted-foreground">{t("common.level")} {progress.level} · {progress.points} {t("common.points")}</p>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Language */}
      <AnimatedSection delay={0.08}>
        <section className="bg-card border border-border rounded-xl shadow-raised overflow-hidden">
          <h2 className="text-xs font-body font-semibold uppercase tracking-[0.06em] text-muted-foreground px-6 pt-5">
            {t("settings.language")}
          </h2>
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border-soft">
            <div>
              <p className="text-sm font-medium">{t("settings.languageRow")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.languageDesc")}</p>
            </div>
            <div className="flex rounded-lg border border-border bg-white/70 p-1" role="group" aria-label={t("settings.language")}>
              <button
                onClick={() => setLanguage("zh")}
                aria-pressed={language === "zh"}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  language === "zh" ? "bg-foreground text-background shadow-soft" : "text-muted-foreground hover:text-foreground"
                )}
              >
                中文
              </button>
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  language === "en" ? "bg-foreground text-background shadow-soft" : "text-muted-foreground hover:text-foreground"
                )}
              >
                English
              </button>
            </div>
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}

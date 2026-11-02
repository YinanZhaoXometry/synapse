import { BookOpen, Check, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { MISTAKES, pickL } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const PRIMARY_CTA =
  "inline-flex items-center gap-2 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2.5 text-sm font-semibold transition-all " +
  "hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

/** Evidence-only mastery pill (prototype masteryPill). */
function masteryPill(value: number, t: (key: string) => string) {
  if (value >= 80) {
    return (
      <span className="pill pill-mastered">
        <span aria-hidden="true">●</span> {t("quiz.nodeMastered")}
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="pill pill-partial">
        <span aria-hidden="true">◐</span> {t("quiz.nodePartial")}
      </span>
    );
  }
  return (
    <span className="pill pill-muted">
      <span aria-hidden="true">○</span> {t("quiz.nodeUncovered")}
    </span>
  );
}

export default function MistakesPage() {
  const { t, language } = useLanguage();
  const { mastery } = useUserProgress();

  const weak = [
    { key: "analytics.topicTesting", value: mastery.testing },
    { key: "analytics.topicRequirements", value: mastery.requirements },
    { key: "analytics.topicCognition", value: 55 },
  ];

  return (
    <div className="max-w-[984px] mx-auto px-6 py-8">
      {/* Page head */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">{t("mistakes.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("mistakes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{t("mistakes.subtitle")}</p>
        </div>
        <button type="button" className={PRIMARY_CTA} onClick={() => toast(t("mistakes.reviewToast"))}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          {t("mistakes.review")}
        </button>
      </div>

      {/* Weak topics card */}
      <section className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("mistakes.weakTitle")}</h2>
            <p className="text-[10px] text-caption mt-0.5">{t("mistakes.weakBody")}</p>
          </div>
          <span className="pill pill-partial">{t("common.demoData")}</span>
        </div>
        <div className="flex flex-col gap-2.5 mt-4">
          {weak.map(w => (
            <div key={w.key} className="grid grid-cols-[108px_1fr_42px_auto] gap-2.5 items-center text-sm">
              <span className="whitespace-nowrap">{t(w.key)}</span>
              <span className="bar-track">
                <span
                  className={cn("bar-fill", w.value >= 80 ? "bar-high" : "bar-mid")}
                  style={{ width: `${w.value}%` }}
                />
              </span>
              <span className="text-right font-bold tabular-nums">{w.value}%</span>
              {masteryPill(w.value, t)}
            </div>
          ))}
        </div>
      </section>

      {/* Mistake cards */}
      <div className="flex flex-col gap-3 mt-4">
        {MISTAKES.map(m => (
          <article key={m.id} className="bg-card border border-border-soft rounded-2xl p-5 shadow-raised">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="pill">{pickL(m.topic, language)}</span>
              <span className="text-[10px] text-caption">{t(m.dateKey)}</span>
            </div>
            <h3 className="font-body text-[15px] font-semibold leading-snug mt-2">{pickL(m.question, language)}</h3>
            <div className="grid gap-2 sm:grid-cols-2 mt-3">
              <div className="compare-box compare-wrong">
                <div className="compare-label">
                  <X className="w-3 h-3" aria-hidden="true" />
                  {t("mistakes.yourAnswer")}
                </div>
                {pickL(m.given, language)}
              </div>
              <div className="compare-box compare-right">
                <div className="compare-label">
                  <Check className="w-3 h-3" aria-hidden="true" />
                  {t("mistakes.correctAnswer")}
                </div>
                {pickL(m.correct, language)}
              </div>
            </div>
            <div className="ai-note">
              <Sparkles className="w-[15px] h-[15px] mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
              <span>
                <strong className="font-semibold">{t("mistakes.analysis")}：</strong>
                {pickL(m.note, language)}
              </span>
            </div>
            <span className="citation">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              {pickL(m.source, language)}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

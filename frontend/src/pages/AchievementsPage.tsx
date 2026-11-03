import { Check, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/demo-data";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";

// Northstar prototype v2 — renderAchievements
// (docs/design/northstar-import/prototype-v2/app.js ~2068-2099, ringSvg ~1054).
function AchievementRing({ percent, unlockedCount }: { percent: number; unlockedCount: number }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <div className="relative w-[104px] h-[104px] shrink-0" role="img" aria-label={`${Math.round(percent)}%`}>
      <svg viewBox="0 0 104 104" className="w-full h-full">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <b className="font-display text-2xl font-semibold leading-none tabular-nums">{unlockedCount}</b>
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">/ 12</span>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { progress } = useUserProgress();
  const { t } = useLanguage();

  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;
  const percent = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("ach.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("ach.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[62ch]">{t("ach.subtitle", { n: unlockedCount })}</p>
        </div>
        <span className="pill">{t("common.demoData")}</span>
      </div>

      <div className="mt-4 bg-card border border-border-soft rounded-2xl shadow-raised p-6 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] items-center">
        <AchievementRing percent={percent} unlockedCount={unlockedCount} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { value: progress.streak, label: t("ach.streak") },
            { value: progress.level, label: t("ach.level") },
            { value: unlockedCount, label: t("ach.badges") },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border-soft bg-[var(--surface-warm)] px-3.5 py-3">
              <b className="block font-display text-2xl font-semibold leading-[1.1] tabular-nums">{stat.value}</b>
              <span className="block text-[10px] text-caption mt-[3px]">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ACHIEVEMENTS.map(a => (
          <div
            key={a.id}
            className={
              "flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border-soft shadow-soft min-h-[152px]" +
              (a.unlocked ? "" : " opacity-[0.62]")
            }
          >
            <span
              aria-hidden="true"
              className={
                "w-12 h-12 rounded-[13px] grid place-items-center text-[22px] " +
                (a.unlocked ? "bg-[var(--surface-warm)]" : "bg-[hsl(var(--uncovered-fill))]")
              }
            >
              {a.emoji}
            </span>
            <span className="text-xs font-semibold leading-[1.35]">{t(a.key)}</span>
            <span className="text-[10px] text-caption leading-normal">{t(a.desc)}</span>
            <span className={"mt-auto text-[10px] font-bold flex items-center gap-1 " + (a.unlocked ? "text-accent-ink" : "text-caption")}>
              {a.unlocked ? <Check className="w-3 h-3" aria-hidden="true" /> : <Lock className="w-3 h-3" aria-hidden="true" />}
              {a.unlocked ? t("ach.unlocked") : t("ach.locked")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

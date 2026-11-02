import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Flame, Target, Check, Clock, Star, BookOpen, HelpCircle, Layers,
  MessageSquare, ChevronRight, ArrowRight, type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { ACHIEVEMENTS, fmtNum } from "@/lib/demo-data";

/* Weekly ring — inline SVG per prototype ringSvg(weeklyPct, 150, 11). */
function WeeklyRing({ percent }: { percent: number }) {
  const size = 150;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(percent)}%`} className="w-full h-full">
      <defs>
        <linearGradient id="weekly-ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--grad-a))" />
          <stop offset="100%" stopColor="hsl(var(--grad-b))" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#weekly-ring-grad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={offset.toFixed(1)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function StatCard({ tint, icon: Icon, label, value, sub }: {
  tint: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-[18px] flex flex-col gap-2">
      <span className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center ${tint}`} aria-hidden="true">
        <Icon className="w-[17px] h-[17px]" />
      </span>
      <span className="text-xs font-semibold text-muted-foreground tracking-[0.02em]">{label}</span>
      <span className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-[1.45]">{sub}</span>
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: "/quiz", icon: HelpCircle, tint: "tint-coral", titleKey: "dashboard.quickQuiz", descKey: "dashboard.quickQuizDesc" },
  { to: "/flashcards", icon: Layers, tint: "tint-amber", titleKey: "dashboard.quickCards", descKey: "dashboard.quickCardsDesc" },
  { to: "/materials", icon: BookOpen, tint: "tint-green", titleKey: "dashboard.quickMaterials", descKey: "dashboard.quickMaterialsDesc" },
  { to: "/ai-tutor", icon: MessageSquare, tint: "tint-blue", titleKey: "dashboard.quickTutor", descKey: "dashboard.quickTutorDesc" },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const { progress } = useUserProgress();

  const weeklyPct = Math.round((progress.weeklyProgress / progress.weeklyGoal) * 100);
  const accuracy = Math.round((progress.correctAnswers / progress.totalAnswers) * 100);
  const hours = (progress.studyMinutes / 60).toFixed(1);
  const unlocked = ACHIEVEMENTS.filter(a => a.unlocked).slice(0, 4);

  const stats = [
    { tint: "tint-coral", icon: Target, label: t("dashboard.weeklyGoal"), value: `${weeklyPct}%`, sub: t("dashboard.weeklyGoalSub", { done: progress.weeklyProgress, target: progress.weeklyGoal }) },
    { tint: "tint-green", icon: Check, label: t("dashboard.accuracy"), value: `${accuracy}%`, sub: t("dashboard.accuracySub") },
    { tint: "tint-amber", icon: Clock, label: t("dashboard.studyTime"), value: `${hours} ${t("common.hoursUnit")}`, sub: t("dashboard.studyTimeSub") },
    { tint: "tint-blue", icon: Star, label: t("dashboard.levelLabel"), value: String(progress.level), sub: t("dashboard.levelSub", { points: fmtNum(progress.points) }) },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      {/* Greeting row */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1 className="font-display font-bold tracking-tight text-3xl md:text-[38px] leading-[1.16] mt-1.5">
            {t("dashboard.greetingA")}
            <em className="italic text-accent-ink">Yinan</em>
            {t("dashboard.greetingB")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("dashboard.greetingSub")}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="pill pill-streak"
            title={`${t("dashboard.streak", { n: progress.streak })} · ${t("dashboard.streakRule")}`}
          >
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            {t("dashboard.streak", { n: progress.streak })}
          </span>
          <span className="text-[10px] text-muted-foreground">{t("dashboard.streakRule")}</span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {stats.map(s => (
          <StatCard key={s.label} tint={s.tint} icon={s.icon} label={s.label} value={s.value} sub={s.sub} />
        ))}
      </div>

      {/* Main split */}
      <div className="grid lg:grid-cols-5 gap-4 mt-4 items-start">
        {/* Left: continue + quick actions */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-w-0">
          <div className="rounded-2xl border shadow-raised p-5 flex items-center gap-4 bg-[linear-gradient(135deg,rgba(255,126,95,0.13),rgba(254,180,123,0.16))] border-[color:rgba(255,126,95,0.18)]">
            <span className="w-[46px] h-[46px] rounded-xl flex-none grid place-items-center bg-[var(--glass-4)] text-accent-ink" aria-hidden="true">
              <BookOpen className="w-[22px] h-[22px]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold">{t("dashboard.continueReading")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.continueReadingSub")}</div>
            </div>
            <button
              type="button"
              onClick={() => toast(t("dashboard.readerToast"))}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold bg-[var(--glass-4)] border border-border hover:bg-[var(--glass-solid)] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer whitespace-nowrap"
            >
              {t("common.open")}
              <ArrowRight className="w-[15px] h-[15px]" aria-hidden="true" />
            </button>
          </div>

          <div>
            <div className="mb-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("dashboard.quickActions")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(q => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-start gap-[11px] p-[14px] rounded-xl border border-border-soft bg-card shadow-soft text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={`w-[38px] h-[38px] rounded-[11px] flex-none grid place-items-center ${q.tint}`} aria-hidden="true">
                    <q.icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold">{t(q.titleKey)}</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5 leading-[1.45]">{t(q.descKey)}</span>
                  </span>
                  <span className="ml-auto self-center text-caption" aria-hidden="true">
                    <ChevronRight className="w-[15px] h-[15px]" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: weekly ring */}
        <div className="lg:col-span-2 bg-card border border-border-soft rounded-2xl shadow-raised p-6 flex flex-col items-center gap-3">
          <p className="eyebrow">{t("dashboard.weeklyRing")}</p>
          <div className="relative w-[150px] h-[150px]">
            <WeeklyRing percent={weeklyPct} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
              <b className="font-display text-[32px] font-semibold leading-none tabular-nums">{weeklyPct}%</b>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("dashboard.weeklyRing")}</span>
            </div>
          </div>
          <div className="text-center">
            <b className="block text-[13px] font-semibold">{t("dashboard.ringSub", { done: progress.weeklyProgress, target: progress.weeklyGoal })}</b>
            <span className="block text-[11px] text-muted-foreground mt-0.5">{t("dashboard.streakRule")}</span>
          </div>
        </div>
      </div>

      {/* Recent achievements */}
      <div className="flex items-center justify-between gap-4 mt-8 mb-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("dashboard.recent")}</h2>
        <Link
          to="/achievements"
          className="text-[13px] font-semibold text-accent-ink hover:underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {t("common.viewAll")}
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {unlocked.map(a => (
          <div key={a.id} className="p-3 rounded-xl bg-card border border-border-soft flex items-center gap-[9px] min-w-0">
            <span className="w-8 h-8 rounded-[9px] grid place-items-center bg-[var(--surface-warm)] text-base flex-none" aria-hidden="true">{a.emoji}</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold leading-[1.3] line-clamp-2">{t(a.key)}</span>
              <span className="block text-[9px] text-muted-foreground mt-px whitespace-nowrap">{t("ach.unlocked")}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

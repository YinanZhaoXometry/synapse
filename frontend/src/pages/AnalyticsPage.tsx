import type { ReactNode } from "react";
import { Check, Clock, Info, Layers, Target } from "lucide-react";
import {
  ACCURACY_VALUES,
  fmtNum,
  TOPIC_ROWS,
  WEEK_DAYS,
  WEEK_VALUES,
  type Lang,
} from "@/lib/demo-data";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";

// Northstar prototype v2 — renderAnalytics + weeklyChart + accuracyChart + statCard
// (docs/design/northstar-import/prototype-v2/app.js ~2102-2203, ~1354-1361).

function StatCard({ tint, icon, label, value, sub }: { tint: string; icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-[18px] flex flex-col gap-2">
      <span className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center ${tint}`} aria-hidden="true">
        {icon}
      </span>
      <span className="text-xs font-semibold text-muted-foreground tracking-wide">{label}</span>
      <span className="font-display text-[26px] font-semibold tracking-tight leading-tight tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-[1.45]">{sub}</span>
    </div>
  );
}

/* Weekly bars — prototype weeklyChart math (viewBox 520x240). */
function WeeklyChart({ language, ariaLabel }: { language: Lang; ariaLabel: string }) {
  const w = 520, h = 240, left = 40, right = 14, top = 18, bottom = 34;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const max = 100;
  const step = plotW / WEEK_VALUES.length;
  const barW = Math.min(38, step * 0.52);
  const grid = [0, 25, 50, 75, 100].map(v => {
    const y = top + plotH * (1 - v / max);
    return (
      <g key={`g${v}`}>
        <line x1={left} y1={y.toFixed(1)} x2={w - right} y2={y.toFixed(1)} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 5" />
        <text x={left - 8} y={(y + 3.5).toFixed(1)} textAnchor="end" fontSize={9} fill="hsl(var(--caption))">{v}</text>
      </g>
    );
  });
  const bars = WEEK_VALUES.map((v, i) => {
    const x = left + step * i + (step - barW) / 2;
    const bh = plotH * (v / max);
    const y = top + plotH - bh;
    return (
      <g key={`b${i}`}>
        <rect x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)} height={bh.toFixed(1)} rx={4} fill="url(#weekGrad)" />
        <text x={(left + step * i + step / 2).toFixed(1)} y={h - 12} textAnchor="middle" fontSize={10} fill="hsl(var(--caption))">
          {WEEK_DAYS[language][i]}
        </text>
        <text x={(left + step * i + step / 2).toFixed(1)} y={(y - 7).toFixed(1)} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}</text>
      </g>
    );
  });
  return (
    <svg className="chart w-full h-auto mt-3" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--grad-a))" />
          <stop offset="100%" stopColor="hsl(var(--grad-b))" />
        </linearGradient>
      </defs>
      {grid}
      {bars}
    </svg>
  );
}

/* Accuracy trend — prototype accuracyChart math (viewBox 520x240, domain 50-100). */
function AccuracyChart({ ariaLabel }: { ariaLabel: string }) {
  const w = 520, h = 240, left = 40, right = 14, top = 18, bottom = 34;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const min = 50, max = 100;
  const n = ACCURACY_VALUES.length;
  const grid = [50, 60, 70, 80, 90, 100].map(v => {
    const y = top + plotH * (1 - (v - min) / (max - min));
    return (
      <g key={`g${v}`}>
        <line x1={left} y1={y.toFixed(1)} x2={w - right} y2={y.toFixed(1)} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 5" />
        <text x={left - 8} y={(y + 3.5).toFixed(1)} textAnchor="end" fontSize={9} fill="hsl(var(--caption))">{v}</text>
      </g>
    );
  });
  const pts = ACCURACY_VALUES
    .map((v, i) => `${(left + (plotW / (n - 1)) * i).toFixed(1)},${(top + plotH * (1 - (v - min) / (max - min))).toFixed(1)}`)
    .join(" ");
  const dots = ACCURACY_VALUES.map((v, i) => {
    const x = left + (plotW / (n - 1)) * i;
    const y = top + plotH * (1 - (v - min) / (max - min));
    const xl = i === 0 || i === n - 1 || i === 3
      ? <text x={x.toFixed(1)} y={h - 12} textAnchor="middle" fontSize={9} fill="hsl(var(--caption))">{i + 1}</text>
      : null;
    return (
      <g key={`d${i}`}>
        <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={4} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2} />
        <text x={x.toFixed(1)} y={(y - 10).toFixed(1)} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}</text>
        {xl}
      </g>
    );
  });
  return (
    <svg className="chart w-full h-auto mt-3" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
      {grid}
      <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {dots}
    </svg>
  );
}

/* Prototype masteryPill (~1075): ● mastered / ◐ partial / ○ uncovered. */
function MasteryPill({ value }: { value: number }) {
  const { t } = useLanguage();
  if (!value) {
    return <span className="pill pill-muted"><span aria-hidden="true">○</span>{t("quiz.nodeUncovered")}</span>;
  }
  if (value >= 80) {
    return <span className="pill pill-mastered"><span aria-hidden="true">●</span>{t("quiz.nodeMastered")}</span>;
  }
  return <span className="pill pill-partial"><span aria-hidden="true">◐</span>{t("quiz.nodePartial")}</span>;
}

function masteryFill(value: number): string {
  if (!value) return "hsl(var(--uncovered-fill))";
  return value >= 80 ? "hsl(var(--mastered))" : "hsl(var(--partial))";
}

export default function AnalyticsPage() {
  const { progress, mastery } = useUserProgress();
  const { t, language } = useLanguage();

  const hours = (progress.studyMinutes / 60).toFixed(1);
  const accuracy = progress.totalAnswers > 0 ? Math.round((progress.correctAnswers / progress.totalAnswers) * 100) : 0;
  const totalMinutes = WEEK_VALUES.reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("analytics.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[62ch]">{t("analytics.subtitle")}</p>
        </div>
        <span className="pill">{t("common.demoData")}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          tint="tint-coral"
          icon={<Clock className="w-[17px] h-[17px]" />}
          label={t("analytics.weekly")}
          value={t("analytics.weeklyVal", { n: hours })}
          sub={t("dashboard.studyTimeSub")}
        />
        <StatCard
          tint="tint-green"
          icon={<Check className="w-[17px] h-[17px]" />}
          label={t("analytics.accuracy")}
          value={`${accuracy}%`}
          sub={t("dashboard.accuracySub")}
        />
        <StatCard
          tint="tint-blue"
          icon={<Layers className="w-[17px] h-[17px]" />}
          label={t("analytics.answers")}
          value={fmtNum(progress.totalAnswers)}
          sub={t("analytics.chartAccuracySub")}
        />
        <StatCard
          tint="tint-amber"
          icon={<Target className="w-[17px] h-[17px]" />}
          label={t("analytics.nodes")}
          value="6"
          sub={t("analytics.chartTopicsSub")}
        />
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">{t("analytics.chartWeekly")}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.chartWeeklySub")}</p>
            </div>
            <span className="pill">{t("analytics.weeklyVal", { n: hours })}</span>
          </div>
          <WeeklyChart language={language} ariaLabel={t("analytics.chartWeekly")} />
        </div>

        <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">{t("analytics.chartAccuracy")}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.chartAccuracySub")}</p>
            </div>
            <span className="pill">{accuracy}%</span>
          </div>
          <AccuracyChart ariaLabel={t("analytics.chartAccuracy")} />
        </div>

        <div className="lg:col-span-2 bg-card border border-border-soft rounded-2xl shadow-raised p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">{t("analytics.chartTopics")}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.chartTopicsSub")}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {TOPIC_ROWS.map(row => {
              const val = row.topic ? mastery[row.topic] : (row.value ?? 0);
              return (
                <div key={row.key} className="grid grid-cols-[108px_1fr_42px_auto] items-center gap-2.5 text-sm">
                  <span className="truncate text-muted-foreground">{t(row.key)}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${val}%`, background: masteryFill(val) }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{val}%</span>
                  <MasteryPill value={val} />
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info className="w-[15px] h-[15px] shrink-0" aria-hidden="true" />
            {t("analytics.chartNote", { n: totalMinutes })}
          </p>
        </div>
      </div>
    </div>
  );
}

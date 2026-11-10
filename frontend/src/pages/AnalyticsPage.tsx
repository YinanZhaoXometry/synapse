/**
 * The /analytics re-point (FR-26, epic P2-09 T5): the page renders the THREE
 * server series from analyticsSeries (T1's read model) and nothing else —
 *
 *   (a) Mastery by Knowledge Node — every node as a bar, ordered WEAKEST
 *       first (score asc), the raw server score% rendered verbatim (the
 *       string-carrying-percent convention) and the state through the shared
 *       NodeStateBadge contract (glyph + tint + label, AD-14: the client
 *       renders, never recomputes);
 *   (b) the quiz-accuracy weekly trend — the scaffold's chart pattern kept
 *       (the prototype's SVG bars), fed by weeklyAccuracy: the last 8 ISO
 *       weeks (Mon-UTC) that carry evidence, accuracy = correct/answered per
 *       week, week-start labels;
 *   (c) the 14-day study consistency — a compact day strip: evidence days
 *       filled with their distinct-session count, zero days hollow (a quiet
 *       day is still a day), today highlighted. Sessions, never minutes
 *       (SM-C3).
 *
 * The demo fixtures (the fake topic rows, week minutes and accuracy values)
 * and the minutes/level/AI-vs-manual remnants retired with this re-point —
 * no demo fallbacks remain; the empty states are honest. The demo progress
 * context is gone from this page (the retirement progresses; the context
 * file itself dies in T6).
 */
import { Link } from "react-router-dom";
import { Check, Flame, Info, Layers, Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAnalyticsSeriesQuery } from "@/api";
import { NodeStateBadge } from "@/features/plans";
import { cn } from "@/lib/utils";
import type { HubNodeMasteryView, HubWeeklyAccuracyView } from "@/api";
import PageLoader from "@/components/shared/PageLoader";

const STAT_CARD =
  "bg-card border border-border-soft rounded-2xl shadow-raised p-[18px] flex flex-col gap-2";

function StatCard({ tint, icon, label, value, sub }: { tint: string; icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className={STAT_CARD}>
      <span className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center ${tint}`} aria-hidden="true">
        {icon}
      </span>
      <span className="text-xs font-semibold text-muted-foreground tracking-wide">{label}</span>
      <span className="font-display text-[26px] font-semibold tracking-tight leading-tight tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-[1.45]">{sub}</span>
    </div>
  );
}

/** The week-start label off the ISO Monday day key ("2026-10-05" → "10/5")
 * — numeric on both languages, deterministic across locales/timezones. */
export function weekStartLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  if (!y || !m || !d) return weekStart;
  return `${m}/${d}`;
}

/** Per-week accuracy percent — the page's rendering math over the server's
 * per-week correct/answered (AD-14: the buckets themselves are server-made). */
export function weekAccuracyPercent(point: HubWeeklyAccuracyView): number {
  if (point.answered <= 0) return 0;
  return Math.round((point.correct / point.answered) * 100);
}

/* Weekly accuracy bars — the scaffold weeklyChart math (viewBox 520x240),
   fed by the real ISO weeks. */
function WeeklyAccuracyChart({ points, ariaLabel }: { points: HubWeeklyAccuracyView[]; ariaLabel: string }) {
  const w = 520, h = 240, left = 40, right = 14, top = 18, bottom = 34;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const max = 100;
  const step = plotW / points.length;
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
  const bars = points.map((point, i) => {
    const v = weekAccuracyPercent(point);
    const x = left + step * i + (step - barW) / 2;
    const bh = plotH * (v / max);
    const y = top + plotH - bh;
    return (
      <g key={`b${point.weekStart}`} data-accuracy={String(v)}>
        <rect x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)} height={bh.toFixed(1)} rx={4} fill="url(#weekGrad)" />
        <text x={(left + step * i + step / 2).toFixed(1)} y={h - 12} textAnchor="middle" fontSize={10} fill="hsl(var(--caption))">
          <tspan data-weeklabel>{weekStartLabel(point.weekStart)}</tspan>
        </text>
        <text x={(left + step * i + step / 2).toFixed(1)} y={(y - 7).toFixed(1)} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}</text>
      </g>
    );
  });
  return (
    <svg data-testid="weekly-accuracy-chart" className="chart w-full h-auto mt-3" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
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

/* One mastery bar row: title + bar + raw server score + the shared state badge. */
function NodeMasteryRow({ row }: { row: HubNodeMasteryView }) {
  const score = Number(row.masteryScore);
  const width = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <div data-testid="node-mastery-row" data-score={row.masteryScore} className="grid grid-cols-[minmax(96px,160px)_1fr_52px_auto] items-center gap-2.5 text-sm">
      <span className="truncate text-muted-foreground" title={row.nodeTitle}>{row.nodeTitle}</span>
      <span className="bar-track">
        <span
          data-testid="node-mastery-bar"
          data-width={String(width)}
          className="bar-fill"
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right font-bold tabular-nums">{row.masteryScore}%</span>
      <NodeStateBadge state={row.state} />
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const seriesQuery = useAnalyticsSeriesQuery();

  // Honest-empty posture: nothing renders until the series lands (no demo
  // fallback, no flash of stale copy).
  if (seriesQuery.loading) return <PageLoader />;

  const series = seriesQuery.data;
  const nodeMastery = series?.nodeMastery ?? [];
  const weeklyAccuracy = series?.weeklyAccuracy ?? [];
  const consistency = [...(series?.consistency ?? [])].sort((a, b) => a.day.localeCompare(b.day));

  // The header stats — counting/reading the series the server returned
  // (rendering math, never a recompute of scores).
  const masteredCount = nodeMastery.filter(row => row.state === "mastered").length;
  const latestWeek = weeklyAccuracy.length > 0 ? weeklyAccuracy[weeklyAccuracy.length - 1] : undefined;
  const activeDays = consistency.filter(day => day.sessionCount > 0).length;
  const sessions14 = consistency.reduce((sum, day) => sum + day.sessionCount, 0);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("analytics.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[62ch]">{t("analytics.subtitle")}</p>
        </div>
      </div>

      {seriesQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-4" role="alert">
          <p className="text-sm font-semibold">{t("analytics.seriesLoadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => void seriesQuery.refetch()}
          >
            {t("analytics.retry")}
          </button>
        </div>
      ) : (
        <>
          {/* Header stats — every value reads the series (sessions, never minutes — SM-C3) */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              tint="tint-blue"
              icon={<Layers className="w-[17px] h-[17px]" />}
              label={t("analytics.statNodes")}
              value={String(nodeMastery.length)}
              sub={t("analytics.statNodesSub", { mastered: masteredCount })}
            />
            <StatCard
              tint="tint-green"
              icon={<Target className="w-[17px] h-[17px]" />}
              label={t("analytics.statAccuracy")}
              value={latestWeek ? `${weekAccuracyPercent(latestWeek)}%` : "—"}
              sub={t("analytics.statAccuracySub")}
            />
            <StatCard
              tint="tint-amber"
              icon={<Flame className="w-[17px] h-[17px]" />}
              label={t("analytics.statActiveDays")}
              value={String(activeDays)}
              sub={t("analytics.statActiveDaysSub")}
            />
            <StatCard
              tint="tint-coral"
              icon={<Check className="w-[17px] h-[17px]" />}
              label={t("analytics.statSessions")}
              value={String(sessions14)}
              sub={t("analytics.statSessionsSub")}
            />
          </div>

          <div className="mt-4 grid lg:grid-cols-2 gap-5">
            {/* (b) Weekly accuracy trend — real ISO weeks, scaffold chart pattern kept */}
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">{t("analytics.weeklyTrend")}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.weeklyTrendSub")}</p>
                </div>
                {latestWeek && <span className="pill">{weekAccuracyPercent(latestWeek)}%</span>}
              </div>
              {weeklyAccuracy.length > 0 ? (
                <WeeklyAccuracyChart points={weeklyAccuracy} ariaLabel={t("analytics.weeklyTrend")} />
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">{t("analytics.weeklyAccuracyEmpty")}</p>
              )}
            </div>

            {/* (c) Study consistency — the honest 14-day strip */}
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">{t("analytics.consistency")}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.consistencySub")}</p>
                </div>
                <span className="pill">{sessions14}</span>
              </div>
              <div data-testid="consistency-strip" className="mt-4" role="img" aria-label={t("analytics.consistencyAria")}>
                <div className="grid grid-cols-7 gap-2">
                  {consistency.map(day => (
                    <span
                      key={day.day}
                      data-day={day.day}
                      data-filled={day.sessionCount > 0 ? "true" : "false"}
                      data-today={day.day === todayKey ? "true" : undefined}
                      title={day.day}
                      className={cn(
                        "h-9 rounded-lg border grid place-items-center text-[10px] font-bold tabular-nums",
                        day.sessionCount > 0
                          ? "bg-gradient-to-r from-grad-a to-grad-b border-transparent text-white"
                          : "bg-[hsl(var(--uncovered-fill))] border-border",
                        day.day === todayKey && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                      )}
                    >
                      {day.sessionCount > 0 ? day.sessionCount : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* (a) Mastery by knowledge node — weakest first, shared state badges */}
            <div className="lg:col-span-2 bg-card border border-border-soft rounded-2xl shadow-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">{t("analytics.nodeMastery")}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("analytics.nodeMasterySub")}</p>
                </div>
              </div>
              {nodeMastery.length > 0 ? (
                <>
                  <div className="mt-4 space-y-3">
                    {[...nodeMastery]
                      .sort((a, b) => Number(a.masteryScore) - Number(b.masteryScore))
                      .map(row => <NodeMasteryRow key={row.nodeId} row={row} />)}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Info className="w-[15px] h-[15px] shrink-0" aria-hidden="true" />
                    {t("analytics.nodeMasterySub")}
                  </p>
                </>
              ) : (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">{t("analytics.nodeMasteryEmpty")}</p>
                  <Link
                    to="/plans"
                    className="inline-flex items-center gap-2 mt-3 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("planner.emptyCta")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

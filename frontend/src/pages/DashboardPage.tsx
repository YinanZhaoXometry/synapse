/**
 * The /dashboard re-point (FR-25, epic P2-09 T5): the page renders plan
 * evidence from the typed hooks and nothing else —
 *
 *  • the time-of-day greeting (zh/en; the zh 早上好/下午好/晚上好 forms),
 *  • the SERVER streak (the T3 useStreakQuery precedent, AD-14),
 *  • four KPI cards from real reads, each deep-linking its hub: 学习计划
 *    (plans count + the nodes' mastered count off the analytics series),
 *    本周学习 (weeklyGoal's current ISO week sessions vs target — SM-C3
 *    sessions, never minutes), 连续记录 (the server streak), 错题本 (the
 *    mistakes-hub length);
 *  • the weekly goal ring: currentWeekSessions / target from weeklyGoal,
 *    honest on partial weeks (it counts the CURRENT ISO week so far — no
 *    projection is ever invented, and the ratio caps at 100%);
 *  • plan-first quick actions on real routes (创建学习计划 → /plan/new,
 *    今日学习 → /planner, 快速测验 → /quiz);
 *  • the recent-unlocked badges summary off badgeState — the server truth,
 *    with a real "none yet" empty state (the emoji faces ride the shared
 *    lib/badges map since T6 lifted them there).
 *
 * The demo progress context, the demo fixtures and the fake continue-reading
 * card retired with this re-point — no demo fallbacks remain (T6 finished
 * the context retirement).
 */
import { Link } from "react-router-dom";
import {
  BookOpen, ChevronRight, Flame, HelpCircle, PlusCircle, CalendarCheck,
  AlertTriangle, Sparkles, type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useAnalyticsSeriesQuery,
  useBadgeStatesQuery,
  useMistakesHubQuery,
  useStreakQuery,
  useWeeklyGoalQuery,
  usePlansQuery,
} from "@/api";
import { badgeEmoji } from "@/lib/badges";

/** The time-of-day greeting key off the local hour (pure seam — tests pin
 * the boundaries): morning < 12, afternoon < 18, evening otherwise. */
export function greetingKey(hour: number): string {
  if (hour < 12) return "dashboard.greetingMorning";
  if (hour < 18) return "dashboard.greetingAfternoon";
  return "dashboard.greetingEvening";
}

/* Weekly ring — the scaffold's inline SVG per prototype ringSvg(150, 11).
   No animation rides the ring (a static ratio), so reduce-motion holds
   trivially; the percent never exceeds 100 (honest cap on overshoot). */
function GoalRing({ percent, ariaLabel }: { percent: number; ariaLabel: string }) {
  const size = 150;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const capped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - capped / 100);
  return (
    <svg data-testid="goal-ring" data-percent={String(capped)} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="w-full h-full">
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

const CARD_LINK =
  "bg-card border border-border-soft rounded-2xl shadow-raised p-[18px] flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One KPI card, deep-linking its hub (the whole card is the link). */
function KpiCard({ testId, to, tint, icon: Icon, label, value, sub }: {
  testId: string;
  to: string;
  tint: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Link to={to} data-testid={testId} aria-label={`${label}: ${value}`} className={CARD_LINK}>
      <span className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center ${tint}`} aria-hidden="true">
        <Icon className="w-[17px] h-[17px]" />
      </span>
      <span className="text-xs font-semibold text-muted-foreground tracking-[0.02em]">{label}</span>
      <span className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-[1.45]">{sub}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const plansQuery = usePlansQuery();
  const seriesQuery = useAnalyticsSeriesQuery();
  const goalQuery = useWeeklyGoalQuery();
  const streakQuery = useStreakQuery();
  const mistakesQuery = useMistakesHubQuery();
  const badgesQuery = useBadgeStatesQuery();

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  const loading =
    plansQuery.loading || seriesQuery.loading || goalQuery.loading ||
    streakQuery.loading || mistakesQuery.loading || badgesQuery.loading;
  if (loading) return null;

  const plans = plansQuery.data ?? [];
  const nodeMastery = seriesQuery.data?.nodeMastery ?? [];
  const goal = goalQuery.data;
  const streak = streakQuery.data ?? 0;
  const mistakesCount = mistakesQuery.data?.length ?? 0;
  const unlockedBadges = (badgesQuery.data ?? []).filter(badge => badge.unlocked);

  const greeting = t(greetingKey(new Date().getHours()));
  const masteredCount = nodeMastery.filter(row => row.state === "mastered").length;
  const goalPercent = goal && goal.target > 0
    ? Math.round((goal.currentWeekSessions / goal.target) * 100)
    : 0;

  const stats = [
    {
      testId: "kpi-plans", to: "/plans", tint: "tint-blue", icon: BookOpen,
      label: t("dashboard.kpiPlans"), value: String(plans.length),
      sub: t("dashboard.kpiPlansSub", { mastered: masteredCount, total: nodeMastery.length }),
    },
    {
      testId: "kpi-week", to: "/planner", tint: "tint-coral", icon: CalendarCheck,
      label: t("dashboard.kpiWeek"), value: goal ? t("dashboard.kpiWeekValue", { done: goal.currentWeekSessions, target: goal.target }) : "—",
      sub: t("dashboard.weeklyRing"),
    },
    {
      // 连续记录 → /analytics (epic-25 T4, audit #12): one KPI, one hub —
      // 本周学习 keeps /planner, the streak's trend lives in analytics.
      testId: "kpi-streak", to: "/analytics", tint: "tint-amber", icon: Flame,
      label: t("dashboard.kpiStreak"), value: t("dashboard.kpiStreakValue", { n: streak }),
      sub: t("dashboard.streakRule"),
    },
    {
      testId: "kpi-mistakes", to: "/mistakes", tint: "tint-green", icon: AlertTriangle,
      label: t("dashboard.kpiMistakes"), value: String(mistakesCount),
      sub: t("dashboard.kpiMistakesSub"),
    },
  ];

  const quickActions = [
    { to: "/plan/new", icon: PlusCircle, tint: "tint-blue", titleKey: "dashboard.quickPlan", descKey: "dashboard.quickPlanDesc" },
    { to: "/planner", icon: CalendarCheck, tint: "tint-coral", titleKey: "dashboard.quickToday", descKey: "dashboard.quickTodayDesc" },
    { to: "/quiz", icon: HelpCircle, tint: "tint-amber", titleKey: "dashboard.quickQuiz", descKey: "dashboard.quickQuizDesc" },
  ];

  const loadFailed = plansQuery.error || seriesQuery.error || goalQuery.error ||
    streakQuery.error || mistakesQuery.error || badgesQuery.error;

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      {/* Greeting row — time-of-day + the server streak pill */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1 className="font-display font-bold tracking-tight text-3xl md:text-[38px] leading-[1.16] mt-1.5">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("dashboard.greetingSub")}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="pill pill-streak"
            title={`${t("dashboard.streak", { n: streak })} · ${t("dashboard.streakRule")}`}
          >
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            {t("dashboard.streak", { n: streak })}
          </span>
          <span className="text-[10px] text-muted-foreground">{t("dashboard.streakRule")}</span>
        </div>
      </div>

      {loadFailed ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-4" role="alert">
          <p className="text-sm font-semibold">{t("dashboard.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => {
              void plansQuery.refetch();
              void seriesQuery.refetch();
              void goalQuery.refetch();
              void streakQuery.refetch();
              void mistakesQuery.refetch();
              void badgesQuery.refetch();
            }}
          >
            {t("dashboard.retry")}
          </button>
        </div>
      ) : (
        <>
          {/* KPI grid — every card reads real server state and deep-links its hub */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {stats.map(s => (
              <KpiCard key={s.testId} {...s} />
            ))}
          </div>

          {/* Main split: quick actions (left) + the weekly goal ring (right) */}
          <div className="grid lg:grid-cols-5 gap-4 mt-4 items-start">
            <div className="lg:col-span-3 min-w-0">
              <div className="mb-3">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("dashboard.quickActions")}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickActions.map(q => (
                  <Link
                    key={q.to}
                    to={q.to}
                    aria-label={t(q.titleKey)}
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

            {/* The weekly goal ring — current ISO week so far, never a projection */}
            <div className="lg:col-span-2 bg-card border border-border-soft rounded-2xl shadow-raised p-6 flex flex-col items-center gap-3">
              <p className="eyebrow">{t("dashboard.weeklyRing")}</p>
              <div className="relative w-[150px] h-[150px]">
                <GoalRing
                  percent={goalPercent}
                  ariaLabel={`${Math.min(100, goalPercent)}% · ${t("dashboard.ringSub", goal ? { done: goal.currentWeekSessions, target: goal.target } : { done: 0, target: 0 })}`}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                  <b className="font-display text-[32px] font-semibold leading-none tabular-nums">{Math.min(100, goalPercent)}%</b>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("dashboard.weeklyRing")}</span>
                </div>
              </div>
              <div className="text-center">
                <b className="block text-[13px] font-semibold">
                  {goal ? t("dashboard.ringSub", { done: goal.currentWeekSessions, target: goal.target }) : "—"}
                </b>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{t("dashboard.streakRule")}</span>
              </div>
            </div>
          </div>

          {/* Recent achievements — the server's unlocked slice (full page is T6's) */}
          <div className="flex items-center justify-between gap-4 mt-8 mb-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("dashboard.recent")}</h2>
            <Link
              to="/achievements"
              className="text-[13px] font-semibold text-accent-ink hover:underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {t("common.viewAll")}
            </Link>
          </div>
          {unlockedBadges.length === 0 ? (
            <div className="p-5 rounded-xl bg-card border border-border-soft flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{t("dashboard.achievementsEmpty")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.achievementsEmptyBody")}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {unlockedBadges.slice(0, 4).map(badge => {
                const name = t(`ach.${badge.id}`);
                return (
                  <div key={badge.id} className="p-3 rounded-xl bg-card border border-border-soft flex items-center gap-[9px] min-w-0">
                    <span className="w-8 h-8 rounded-[9px] grid place-items-center bg-[var(--surface-warm)] text-base flex-none" aria-hidden="true">
                      {badgeEmoji(badge.id)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold leading-[1.3] line-clamp-2">{name}</span>
                      <span className="block text-[9px] text-muted-foreground mt-px whitespace-nowrap">{t("ach.unlocked")}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

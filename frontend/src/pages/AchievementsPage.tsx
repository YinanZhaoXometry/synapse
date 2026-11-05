/**
 * The /achievements re-point (FR-28, epic P2-09 T6): the page renders the
 * scaffold's 12-badge taxonomy from the SERVER's badgeState read and nothing
 * else — unlocked/locked straight off the wire rows (AD-14: rendering reads,
 * never recomputes), the per-badge counter/threshold as honest progress
 * ("1 / 5"; capped at the threshold when the counter overshoots), never-
 * color-only states (AD-9: a distinct glyph + state word per state, both in
 * the aria label), the server streak (the T3 useStreakQuery precedent), and
 * the shared emoji map (lib/badges — the dashboard imports the same faces).
 *
 * Unlock surfacing (honest v1): a badge that transitions locked→unlocked on
 * a read within the session is celebrated once — sonner toast carrying the
 * animate-confetti vocabulary, collapsed to a plain toast under the motion
 * pref (AD-9). The seen-set is SESSION-scoped module memory (lib/badges):
 * badges already unlocked at session start are baseline, a reload re-baselines
 * silently — no server unlock-moment table exists, so a persistent once-ever
 * surface is recorded out of scope.
 *
 * The demo points/level died with the demo progress context (deleted here —
 * epic-08's A1 retirement completes; nothing real exists on the wire, so no
 * display replaced them). The demo achievements fixture retired with this
 * re-point.
 */
import { useEffect } from "react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useBadgeStatesQuery, useStreakQuery, type HubBadgeStateView } from "@/api";
import { badgeEmoji, collectNewUnlocks, sortBadges } from "@/lib/badges";

// Northstar prototype v2 — ringSvg (~1054). The static SVG ratio never
// animates, so reduce-motion holds trivially; percent caps at 100.
function AchievementRing({ percent, unlockedCount }: { percent: number; unlockedCount: number }) {
  const { t } = useLanguage();
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const capped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - capped / 100);
  return (
    <div className="relative w-[104px] h-[104px] shrink-0">
      <svg data-testid="badge-ring" data-percent={String(capped)} viewBox="0 0 104 104" className="w-full h-full">
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
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("ach.unlockedCount", { n: unlockedCount })}
        </span>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { t } = useLanguage();
  const { reduceMotion } = useTheme();
  const badgesQuery = useBadgeStatesQuery();
  const streakQuery = useStreakQuery();

  // The unlock celebration (session-once): each read diffs against the
  // session's seen-set (lib/badges); fresh locked→unlocked ids toast once.
  // Under the motion pref the confetti vocabulary collapses to a plain toast
  // (AD-9) — and the global body.reduce-motion class kills CSS animation
  // regardless. The effect runs before the loading early-return (hooks order
  // must not depend on data state); it no-ops on the loading reads.
  useEffect(() => {
    if (!badgesQuery.data) return;
    for (const id of collectNewUnlocks(badgesQuery.data)) {
      const name = t(`ach.${id}`);
      if (reduceMotion) {
        toast.success(t("ach.unlockedToastTitle"), { description: name });
      } else {
        toast.success(t("ach.unlockedToastTitle"), {
          description: (
            <span className="animate-confetti inline-flex items-center gap-1.5">
              <span aria-hidden="true">{badgeEmoji(id)}</span>
              {name}
            </span>
          ),
        });
      }
    }
  }, [badgesQuery.data, reduceMotion, t]);

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (badgesQuery.loading || streakQuery.loading) return null;

  const badges: HubBadgeStateView[] = sortBadges(badgesQuery.data ?? []);
  const unlockedCount = badges.filter(badge => badge.unlocked).length;
  const percent = badges.length > 0 ? Math.round((unlockedCount / badges.length) * 100) : 0;
  const streak = streakQuery.data ?? 0;

  if (badgesQuery.error || streakQuery.error) {
    return (
      <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised" role="alert">
          <p className="text-sm font-semibold">{t("ach.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => {
              void badgesQuery.refetch();
              void streakQuery.refetch();
            }}
          >
            {t("ach.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("ach.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("ach.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[62ch]">{t("ach.subtitle", { n: unlockedCount })}</p>
        </div>
      </div>

      <div className="mt-4 bg-card border border-border-soft rounded-2xl shadow-raised p-6 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] items-center">
        <AchievementRing percent={percent} unlockedCount={unlockedCount} />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: streak, label: t("ach.streak") },
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
        {badges.map(badge => {
          const unlocked = badge.unlocked;
          return (
            <div
              key={badge.id}
              aria-label={`${t(`ach.${badge.id}`)} · ${unlocked ? t("ach.unlocked") : t("ach.locked")}`}
              className={
                "flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border-soft shadow-soft min-h-[152px]" +
                (unlocked ? "" : " opacity-[0.62]")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "w-12 h-12 rounded-[13px] grid place-items-center text-[22px] " +
                  (unlocked ? "bg-[var(--surface-warm)]" : "bg-[hsl(var(--uncovered-fill))]")
                }
              >
                {badgeEmoji(badge.id)}
              </span>
              <span className="text-xs font-semibold leading-[1.35]">{t(`ach.${badge.id}`)}</span>
              <span className="text-[10px] text-caption leading-normal">{t(`ach.${badge.id}d`)}</span>
              {/* the wire's counter/threshold — honest progress; capped when
                  the counter overshoots (9/1 reads absurd, 1/1 is the truth) */}
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground" data-testid={`badge-progress-${badge.id}`}>
                {t("ach.progress", { done: Math.min(badge.counter, badge.threshold), target: badge.threshold })}
              </span>
              <span className={"mt-auto text-[10px] font-bold flex items-center gap-1 " + (unlocked ? "text-accent-ink" : "text-caption")}>
                {unlocked ? <Check className="w-3 h-3" aria-hidden="true" /> : <Lock className="w-3 h-3" aria-hidden="true" />}
                {unlocked ? t("ach.unlocked") : t("ach.locked")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

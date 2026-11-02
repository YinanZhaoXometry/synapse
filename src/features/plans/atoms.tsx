/**
 * Plans-feature shared atoms — display-contract bits reused by Plans Home and
 * Plan Home surfaces. Token-driven only (no hardcoded palette values).
 */
import { useId } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Mastery ring (ADR-0001 display): brand-gradient arc over the uncovered track. */
export function MasteryRing({ value, size = 64 }: { value: number; size?: number }) {
  const { t } = useLanguage();
  const gradientId = useId();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t("plans.masteryAria", { n: value })}
      className="flex-none"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--grad-a))" />
          <stop offset="100%" stopColor="hsl(var(--grad-b))" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={size * 0.22}
        className="font-display font-bold tabular-nums"
      >
        {value}%
      </text>
    </svg>
  );
}

/** The three-segment node-state mini bar (mastered / partial / uncovered tints). */
export function StateMiniBar({ counts }: { counts: Record<"mastered" | "partial" | "uncovered", number> }) {
  const total = counts.mastered + counts.partial + counts.uncovered;
  const share = (n: number) => `${(n / (total || 1)) * 100}%`;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden mt-2.5" aria-hidden="true">
      <span className="bg-mastered-tint" style={{ width: share(counts.mastered) }} />
      <span className="bg-partial-tint" style={{ width: share(counts.partial) }} />
      <span className="bg-uncovered-tint" style={{ width: share(counts.uncovered) }} />
    </div>
  );
}

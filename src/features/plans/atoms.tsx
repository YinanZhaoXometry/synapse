/**
 * Plans-feature shared atoms — display-contract bits reused by Plans Home and
 * Plan Home surfaces. Token-driven only (no hardcoded palette values).
 */
import { useId, type ReactNode } from "react";
import { Flame, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeState, Outcome } from "@/domain/entities";
import { masteryRingVariant } from "./display-shaping";
import { OUTCOME_LABEL_KEY } from "./outcome-labels";

/**
 * Mastery ring (ADR-0001 display): brand-gradient arc over the uncovered track.
 * At exactly 100 the ring switches to the mastered palette with the readiness
 * label (DESIGN.md display contract; FR-3) — never the brand gradient.
 */
export function MasteryRing({ value, size = 64 }: { value: number; size?: number }) {
  const { t } = useLanguage();
  const gradientId = useId();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const ready = masteryRingVariant(value) === "mastered";
  return (
    <div className="flex flex-col items-center gap-1 flex-none">
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
          stroke={ready ? "var(--mastered-ink)" : `url(#${gradientId})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {!ready && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--grad-a))" />
              <stop offset="100%" stopColor="hsl(var(--grad-b))" />
            </linearGradient>
          </defs>
        )}
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
      {ready && (
        <span className="pill pill-mastered text-[10px] leading-none" aria-hidden="true">
          {t("plans.readyLabel")}
        </span>
      )}
    </div>
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

const STATE_PILL: Record<NodeState, string> = {
  mastered: "pill pill-mastered",
  partial: "pill pill-partial",
  uncovered: "pill pill-muted",
};

const STATE_MARK: Record<NodeState, string> = { mastered: "✦", partial: "◐", uncovered: "○" };

/**
 * Node state as glyph + tint + text label — never color alone (UX display
 * contract; ADR-0001 consumers).
 */
export function StateGlyph({ state }: { state: NodeState }) {
  const { t } = useLanguage();
  const label = state === "mastered" ? t("plans.stateMastered") : state === "partial" ? t("plans.statePartial") : t("plans.stateUncovered");
  return (
    <span className={cn(STATE_PILL[state], "flex-none")}>
      <span aria-hidden="true" className="text-[11px] leading-none">
        {STATE_MARK[state]}
      </span>
      {label}
    </span>
  );
}

const OUTCOME_TINT: Record<Outcome, string> = {
  correct: "tint-green",
  partial: "tint-amber",
  wrong: "tint-danger",
};

const OUTCOME_MARK: Record<Outcome, string> = { correct: "●", partial: "◐", wrong: "✕" };

/** One evidence mark in the popover — outcome glyph + tint (not color alone). */
export function OutcomeMark({ outcome, small = false }: { outcome: Outcome; small?: boolean }) {
  const { t } = useLanguage();
  const label = t(OUTCOME_LABEL_KEY[outcome]);
  return (
    <span
      title={label}
      className={cn(
        "grid place-items-center rounded-full font-semibold flex-none",
        OUTCOME_TINT[outcome],
        small ? "w-3.5 h-3.5 text-[9px]" : "w-5 h-5 text-[10px]",
      )}
    >
      <span aria-hidden="true">{OUTCOME_MARK[outcome]}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Evidence-day streak (FR-25): the counting rule stated on hover — never minutes/logins. */
export function StreakChip({ days }: { days: number }) {
  const { t } = useLanguage();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="pill pill-streak cursor-help" tabIndex={0}>
          <Flame className="w-[13px] h-[13px]" aria-hidden="true" />
          {t("plans.streakDays", { n: days })}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-[1.5]">
        {t("plans.streakRule")}
      </TooltipContent>
    </Tooltip>
  );
}

/** Quiet honesty footnote (e.g. the rollup contract, ADR-0001). */
export function ContractNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-[1.5] text-muted-foreground mt-2 max-w-[220px]">
      <Info className="w-3 h-3 mt-[2px] flex-none" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

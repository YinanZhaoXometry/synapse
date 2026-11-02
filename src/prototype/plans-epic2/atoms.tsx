/**
 * PROTOTYPE (epic-2 UI) — small shared atoms. Display-contract bits (state glyph is
 * never color-only; streak counts evidence days) live here so all variants read the same.
 */
import { useCallback, useState } from "react";
import { Flame, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { NodeState } from "@/domain/entities";

/** Inline bilingual literal helper (prototype exception — real build uses the i18n table). */
export function useLl() {
  const { language } = useLanguage();
  return (zh: string, en: string) => (language === "zh" ? zh : en);
}

const GLYPH: Record<NodeState, { mark: string; cls: string }> = {
  mastered: { mark: "✦", cls: "tint-green" },
  partial: { mark: "◐", cls: "tint-amber" },
  uncovered: { mark: "○", cls: "pill-muted" },
};

/** State glyph + tint + text label — never color alone (UX display contract). */
export function StateGlyph({ state, label }: { state: NodeState; label?: string }) {
  const g = GLYPH[state];
  const ll = useLl();
  const text = label ?? (state === "mastered" ? ll("已掌握", "mastered") : state === "partial" ? ll("进行中", "partial") : ll("未覆盖", "uncovered"));
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[2px] rounded-full text-[10px] font-semibold ${g.cls}`}>
      <span aria-hidden="true" className="text-[11px] leading-none">{g.mark}</span>
      {text}
    </span>
  );
}

export function MasteryRing({ value, size = 64 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Mastery ${value}%`} className="flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#proto-grad)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="proto-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8a5c" />
          <stop offset="100%" stopColor="#ff5f5f" />
        </linearGradient>
      </defs>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="hsl(var(--foreground))" fontSize={size * 0.22} className="font-display font-bold tabular-nums">
        {value}%
      </text>
    </svg>
  );
}

export function StreakChip({ days }: { days: number }) {
  const ll = useLl();
  return (
    <span className="pill pill-streak cursor-help" title={ll("连续天数 = 有 ≥1 次产生证据的学习日的连续天数（不是分钟，不是登录）", "Streak = consecutive days with ≥1 evidence-producing session (never minutes, never logins)")}>
      <Flame className="w-[13px] h-[13px]" aria-hidden="true" />
      {ll(`${days} 天`, `${days} days`)}
    </span>
  );
}

/** Transient note for inert prototype actions (slice 3/5/6 features). */
export function useHint() {
  const [hint, setHint] = useState<string | null>(null);
  const showHint = useCallback((text: string) => {
    setHint(text);
    window.setTimeout(() => setHint(null), 2400);
  }, []);
  return { hint, showHint };
}

export function PrototypeHint({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-xs font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] shadow-raised animate-pop">
      {text}
    </div>
  );
}

/** Prototype-only honesty footnote (e.g. the rollup contract), visually quiet. */
export function ContractNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-[1.5] text-muted-foreground mt-2">
      <Info className="w-3 h-3 mt-[2px] flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}

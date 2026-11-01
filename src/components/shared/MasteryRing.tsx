import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showReadinessBadge?: boolean;
  children?: React.ReactNode;
}

export function MasteryRing({
  progress,
  size = 120,
  strokeWidth = 10,
  className,
  showReadinessBadge = true,
  children,
}: Props) {
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const clamped = Math.max(0, Math.min(100, progress));
  const complete = clamped >= 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(clamped)}%`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="hsl(var(--uncovered-tint))" strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={complete ? "hsl(var(--mastered))" : "hsl(var(--primary))"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {children ?? <span className="mastery-number text-2xl">{Math.round(clamped)}%</span>}
        </div>
      </div>
      {complete && showReadinessBadge && (
        <span className="inline-flex items-center gap-1 rounded-full bg-mastered-tint px-2.5 py-1 text-xs font-medium text-foreground">
          <Check className="w-3.5 h-3.5 text-mastered" />
          {t("mastery.ready")}
        </span>
      )}
    </div>
  );
}

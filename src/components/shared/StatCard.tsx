import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
  /** Northstar focal stat card: brand gradient surface, white text. */
  focal?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, icon, iconClassName, focal, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-raised",
        focal && "bg-gradient-hero text-white border-transparent shadow-brand",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          focal ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white" aria-hidden="true">
              {icon}
            </span>
          ) : iconClassName ? (
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconClassName)} aria-hidden="true">
              {icon}
            </span>
          ) : (
            <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
          )
        )}
        <p className={cn("text-xs font-medium", focal ? "text-white/85" : "text-muted-foreground")}>{label}</p>
      </div>
      <p className="mastery-number mt-2 text-2xl">{value}</p>
      {hint && <p className={cn("mt-0.5 text-xs", focal ? "text-white/75" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
  className?: string;
}

export function StatCard({ label, value, hint, icon, iconClassName, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2">
        {icon && (
          iconClassName ? (
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconClassName)} aria-hidden="true">
              {icon}
            </span>
          ) : (
            <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
          )
        )}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mastery-number mt-2 text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{label}</p>
        {icon && <span className="text-muted-foreground" aria-hidden="true">{icon}</span>}
      </div>
      <p className="mastery-number mt-2 text-2xl md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

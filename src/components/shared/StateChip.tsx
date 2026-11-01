import { Circle, Contrast, CheckCircle2 } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export type StudyState = "mastered" | "partial" | "uncovered";

const stateConfig: Record<StudyState, { icon: typeof Circle; classes: string }> = {
  mastered: {
    icon: CheckCircle2,
    classes: "bg-mastered-tint text-foreground",
  },
  partial: {
    icon: Contrast,
    classes: "bg-partial-tint text-foreground",
  },
  uncovered: {
    icon: Circle,
    classes: "bg-uncovered-tint text-muted-foreground",
  },
};

const glyphColor: Record<StudyState, string> = {
  mastered: "text-mastered",
  partial: "text-partial",
  uncovered: "text-muted-foreground",
};

interface Props {
  state: StudyState;
  label: string;
  className?: string;
}

export function StateChip({ state, label, className }: Props) {
  const { icon: Icon, classes } = stateConfig[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        classes,
        className
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", glyphColor[state])} aria-hidden="true" />
      {label}
    </span>
  );
}

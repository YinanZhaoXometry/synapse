import { Check, X, Eye } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export type QuizOptionState = "idle" | "selected" | "correct" | "wrong" | "forfeit";

interface Props {
  index: number;
  text: string;
  state?: QuizOptionState;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const stateClasses: Record<QuizOptionState, string> = {
  idle: "border-border bg-card hover:border-primary/50 hover:bg-secondary/60",
  selected: "border-primary bg-primary/5",
  correct: "border-[1.5px] border-mastered bg-mastered-tint",
  wrong: "border-[1.5px] border-destructive bg-destructive/[0.08]",
  forfeit: "border-[1.5px] border-partial bg-partial-tint",
};

export function QuizOptionRow({ index, text, state = "idle", disabled, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-state={state}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-default",
        stateClasses[state],
        className
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
          state === "idle" && "border-border text-muted-foreground",
          state === "selected" && "border-primary text-primary",
          state === "correct" && "border-mastered text-mastered",
          state === "wrong" && "border-destructive text-destructive",
          state === "forfeit" && "border-partial text-partial"
        )}
        aria-hidden="true"
      >
        {index + 1}
      </span>
      <span className="flex-1 text-foreground">{text}</span>
      {state === "correct" && <Check className="w-4 h-4 shrink-0 text-mastered" aria-hidden="true" />}
      {state === "wrong" && <X className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />}
      {state === "forfeit" && <Eye className="w-4 h-4 shrink-0 text-partial" aria-hidden="true" />}
    </button>
  );
}

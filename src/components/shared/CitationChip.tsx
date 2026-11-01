import { BookOpen } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  onClick?: () => void;
  className?: string;
}

export function CitationChip({ label, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-citation-tint px-2 py-0.5 text-xs font-medium text-primary",
        onClick && "hover:underline cursor-pointer",
        !onClick && "cursor-default",
        className
      )}
    >
      <BookOpen className="w-3 h-3" aria-hidden="true" />
      {label}
    </button>
  );
}

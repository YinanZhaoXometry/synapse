/**
 * PROTOTYPE (epic-2 UI) — floating variant switcher. DEV-only (gated by the host);
 * ← / → keys cycle, arrows clickable, URL param keeps the choice shareable + reload-stable.
 */
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantDef { key: string; label: string }

export function PrototypeSwitcher({
  variants, current, onCycle,
}: {
  variants: VariantDef[];
  current: string;
  onCycle: (dir: -1 | 1) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key === "ArrowLeft") onCycle(-1);
      if (e.key === "ArrowRight") onCycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCycle]);

  const def = variants.find(v => v.key === current) ?? variants[0];
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1 px-1.5 py-1 rounded-full border border-[hsl(var(--foreground))/20] bg-[hsl(var(--foreground))] text-[hsl(var(--background))] shadow-raised"
      data-prototype-bar="true"
    >
      <button type="button" aria-label="previous variant" onClick={() => onCycle(-1)}
        className="w-7 h-7 grid place-items-center rounded-full hover:bg-[hsl(var(--background)/0.15)] cursor-pointer">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2 text-xs font-semibold tabular-nums whitespace-nowrap">
        {def.key} · {def.label}
      </span>
      <button type="button" aria-label="next variant" onClick={() => onCycle(1)}
        className="w-7 h-7 grid place-items-center rounded-full hover:bg-[hsl(var(--background)/0.15)] cursor-pointer">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

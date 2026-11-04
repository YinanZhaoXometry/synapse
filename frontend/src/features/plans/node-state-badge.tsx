/**
 * The node-state badge — the ONE renderer of the shared display contract
 * (node-state.ts, epic P2-10 T3; FR-6/7): glyph + tint + text label announced
 * by its aria-label, every state distinct (AD-9 never-color-only). The
 * PlanHome tree row, Task Home rows, quiz results rows, and T4's graph nodes
 * all render state through this component.
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { NODE_STATE_DISPLAY, nodeStateAriaLabel, type NodeStateVocabulary } from "./node-state";

export function NodeStateBadge({ state, className }: { state: NodeStateVocabulary; className?: string }) {
  const { t } = useLanguage();
  const display = NODE_STATE_DISPLAY[state];
  return (
    <span
      role="img"
      aria-label={nodeStateAriaLabel(state, t)}
      data-testid="node-state-badge"
      data-state={state}
      className={cn(display.tintClass, "flex-none", className)}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {display.glyph}
      </span>
      {t(display.labelKey)}
    </span>
  );
}

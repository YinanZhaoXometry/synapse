/**
 * The hover popover the annotation bridge opens (epic-24 T2; shared by the
 * markdown article and the pdf pages since the 2026-11-09 hotfix round):
 * note body when present + the remove button. Rendered only while an
 * annotation answers the pointer; the surface owns the anchor math (viewport
 * coords → its own relative box) and the dismissal. Owns useLanguage — the
 * bare renderers (e.g. the anchor-agreement tests) never mount a language
 * context.
 */
import type { RefObject } from "react";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { AnnotationHoverAnchor } from "./annotation-hover";

export interface AnnotationHoverPopoverProps {
  popoverRef: RefObject<HTMLDivElement | null>;
  hover: AnnotationHoverAnchor;
  body?: string;
  flip: boolean;
  left: number;
  top: number;
  onRemove(id: string): void;
}

export function AnnotationHoverPopover({
  popoverRef,
  hover,
  body,
  flip,
  left,
  top,
  onRemove,
}: AnnotationHoverPopoverProps) {
  const { t } = useLanguage();
  return (
    <div
      ref={popoverRef}
      data-testid="annotation-hover-popover"
      data-anno-popover=""
      role="group"
      aria-label={t("reader.annotationRemove")}
      className={cn(
        "absolute z-40 flex max-w-[260px] items-center gap-1.5 rounded-xl border border-border-soft bg-[var(--glass-4)] px-2 py-1.5 shadow-raised backdrop-blur-sm",
        flip ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-[calc(100%+8px)]",
      )}
      style={{ left, top }}
    >
      {body && (
        <span className="min-w-0 flex-1 truncate text-[11px] leading-[1.4] text-muted-foreground" title={body}>
          {body}
        </span>
      )}
      <button
        type="button"
        data-testid="annotation-remove"
        aria-label={t("reader.annotationRemove")}
        title={t("reader.annotationRemove")}
        onClick={() => onRemove(hover.id)}
        className="inline-flex flex-none items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-[var(--glass-2)] hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        {t("reader.annotationRemove")}
      </button>
    </div>
  );
}

/**
 * The annotations list panel (FR-16, epic-13 T3): per-material, collapsible,
 * rendered INSIDE the reader's material zone (a floating card over the
 * reading — toggled from the top bar's 标注 button). The panel is the
 * management + keyboard surface: every row renders textually (AD-9's
 * never-color-only — the engine's tints never carry meaning alone), the row
 * click-to-scrolls through the AD-8 anchor channel (jumpToLocator), delete
 * is its own button, and drifted/missing ranges carry the honest
 * 「原文已变化」 badge — an annotation whose anchor text moved is never
 * silently misplaced.
 *
 * Rows arrive from the last engine application: annotations newest-first
 * (the wire order) joined with each row's apply status (ok / stale /
 * missing / deferred — deferred rows list normally; their page just hasn't
 * rendered its text layer yet).
 */
import { Highlighter, Trash2, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/domain/entities";
import type { AnnotationColor, AnnotationApplyStatus } from "./annotation-engine";

/** One panel row: the annotation + how its last application landed. */
export interface AnnotationRow {
  annotation: Annotation;
  status: AnnotationApplyStatus;
}

const KIND_LABEL_KEY: Record<Annotation["kind"], string> = {
  highlight: "reader.annotationKindHighlight",
  underline: "reader.annotationKindUnderline",
};

const COLOR_DOT_VAR: Record<string, string> = {
  coral: "var(--anno-coral)",
  amber: "var(--anno-amber)",
  emerald: "var(--anno-emerald)",
  blue: "var(--anno-blue)",
};

export interface AnnotationsPanelProps {
  materialId: string;
  /** Newest-first rows, joined with their last engine application status. */
  rows: AnnotationRow[];
  /** Click-to-scroll (the AD-8 anchor channel — ReaderPage jumps + flashes). */
  onJump(annotation: Annotation): void;
  /** Per-row delete (the removeAnnotation mutation's call site). */
  onRemove(id: string): void;
  onClose(): void;
}

export function AnnotationsPanel({ materialId, rows, onJump, onRemove, onClose }: AnnotationsPanelProps) {
  const { t } = useLanguage();
  void materialId; // per-material by construction (the mounter scopes the read)

  return (
    <aside
      aria-label={t("reader.annotationsPanelTitle")}
      data-testid="annotations-panel"
      className="absolute left-3 top-3 bottom-3 w-72 max-w-[80%] z-30 flex flex-col rounded-2xl border border-border-soft bg-card shadow-raised"
    >
      <header className="flex-none flex items-center gap-2 px-3 h-11 border-b border-border-soft">
        <Highlighter className="w-4 h-4 text-accent-ink" aria-hidden="true" />
        <span className="text-sm font-semibold flex-1 min-w-0 truncate">
          {t("reader.annotationsPanelTitle")}
          {rows.length > 0 && <span className="text-muted-foreground font-normal"> · {rows.length}</span>}
        </span>
        <button
          type="button"
          aria-label={t("reader.annotationsPanelCloseAria")}
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground leading-[1.6] px-2 py-4">{t("reader.annotationsEmpty")}</p>
        ) : (
          rows.map(({ annotation, status }) => (
            <div
              key={annotation.id}
              className={cn(
                "group rounded-xl border border-border-soft bg-[var(--glass-2)] px-2.5 py-2 flex items-start gap-2",
                (status === "stale" || status === "missing") && "opacity-70",
              )}
            >
              <button
                type="button"
                aria-label={t("reader.annotationJumpAria")}
                title={t("reader.annotationJumpAria")}
                onClick={() => onJump(annotation)}
                className="flex-1 min-w-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {annotation.color && COLOR_DOT_VAR[annotation.color] && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-2.5 h-2.5 rounded-full border border-border-soft flex-none"
                      style={{ background: COLOR_DOT_VAR[annotation.color] }}
                    />
                  )}
                  {t(KIND_LABEL_KEY[annotation.kind])}
                  {(status === "stale" || status === "missing") && (
                    <span className="text-[10px] px-1 py-px rounded-md bg-[var(--ink-soft)] text-muted-foreground">
                      {t("reader.annotationStale")}
                    </span>
                  )}
                </span>
                <span className="block text-xs leading-[1.5] mt-1 line-clamp-2 text-foreground">
                  {annotation.range.quote}
                </span>
              </button>
              <button
                type="button"
                aria-label={t("reader.annotationDeleteAria")}
                title={t("reader.annotationDeleteAria")}
                onClick={() => onRemove(annotation.id)}
                className="flex-none w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--destructive))] hover:bg-[var(--glass-2)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

/** The color type re-export (the chips and the panel share the vocabulary). */
export type { AnnotationColor };

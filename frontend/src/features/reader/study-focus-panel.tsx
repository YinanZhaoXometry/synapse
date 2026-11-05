/**
 * The Study Focus panel (FR-17, epic-13 T4; OQ-1): the reader-side
 * collapsible 「核心要点」 panel, toggled from the reader toolbar (the
 * delta-grill ruling — rendered INSIDE the material zone like the
 * annotations panel beside which it lives, T3's panel anatomy). The set's
 * items render textually (AD-9: title + detail; the AI's tints never
 * carry meaning), each linkable item deep-links through the AD-8 anchor
 * channel via its server-owned sourceRange (scroll + flash, the citation
 * chips' channel), and the 重新生成 action replaces the active set (the
 * server bumps the generation counter — the vN chip reads the refetched
 * row). Empty states are honest and bilingual: no annotations → highlight
 * first; annotations but no set → the generate CTA.
 */
import { ListChecks, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadingLocator } from "@/domain/entities";
import { cn } from "@/lib/utils";
import type { StudyFocusItemView, StudyFocusSetView } from "@/api";
import { focusSourceLocator } from "./study-focus-locator";

export interface StudyFocusPanelProps {
  materialId: string;
  /** Whether the material carries ≥1 annotation (the gate the server
   * enforces; the CTA hides behind it). Undefined = the read is loading. */
  hasAnnotations: boolean | undefined;
  /** The active set — null when never generated, undefined while loading. */
  set: StudyFocusSetView | null | undefined;
  /** The generation mutation's in-flight flag (the honest 生成中 state). */
  generateLoading: boolean;
  /** Generate or regenerate (the same op — the server replaces the set). */
  onGenerate(): void;
  /** The AD-8 anchor channel's in-reader half (scroll + flash). */
  onJump(locator: ReadingLocator): void;
  onClose(): void;
}

export function StudyFocusPanel({
  materialId,
  hasAnnotations,
  set,
  generateLoading,
  onGenerate,
  onJump,
  onClose,
}: StudyFocusPanelProps) {
  const { t } = useLanguage();
  void materialId; // per-material by construction (the mounter scopes the read)

  const items = set?.items ?? [];

  return (
    <aside
      aria-label={t("reader.studyFocusPanelTitle")}
      data-testid="study-focus-panel"
      className="absolute left-3 top-3 bottom-3 w-72 max-w-[80%] z-30 flex flex-col rounded-2xl border border-border-soft bg-card shadow-raised"
    >
      <header className="flex-none flex items-center gap-2 px-3 h-11 border-b border-border-soft">
        <ListChecks className="w-4 h-4 text-accent-ink" aria-hidden="true" />
        <span className="text-sm font-semibold flex-1 min-w-0 truncate">
          {t("reader.studyFocusPanelTitle")}
          {set && (
            <span
              data-testid="study-focus-generation"
              title={t("reader.studyFocusRegenerate")}
              className="ml-1.5 text-[10px] font-normal px-1.5 py-px rounded-md bg-[var(--ink-soft)] text-muted-foreground tabular-nums align-middle"
            >
              v{set.generation}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label={t("reader.studyFocusPanelCloseAria")}
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {set === undefined ? (
          <p className="text-xs text-muted-foreground leading-[1.6] px-2 py-4">{t("reader.studyFocusLoading")}</p>
        ) : set === null ? (
          hasAnnotations === false ? (
            <p className="text-xs text-muted-foreground leading-[1.6] px-2 py-4">
              {t("reader.studyFocusEmptyNoAnnotations")}
            </p>
          ) : (
            <div className="px-2 py-4 flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={onGenerate}
                disabled={generateLoading}
                data-testid="study-focus-generate"
                className="text-xs font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                {generateLoading ? t("reader.studyFocusGenerating") : t("reader.studyFocusGenerateCta")}
              </button>
            </div>
          )
        ) : generateLoading ? (
          <p className="text-xs text-muted-foreground leading-[1.6] px-2 py-4" aria-live="polite">
            {t("reader.studyFocusGenerating")}
          </p>
        ) : (
          <>
            {items.map((item) => (
              <FocusItemRow key={item.id} item={item} onJump={onJump} />
            ))}
            <button
              type="button"
              onClick={onGenerate}
              disabled={generateLoading}
              data-testid="study-focus-regenerate"
              className="mt-1 self-start inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2 py-1.5"
            >
              {t("reader.studyFocusRegenerate")}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** One item row: title + detail rendered textually; a linkable row is ONE
 * button (the keyboard path — the annotations panel's row anatomy), a
 * range-less item renders as plain text (honestly unlinkable). */
function FocusItemRow({ item, onJump }: { item: StudyFocusItemView; onJump: (locator: ReadingLocator) => void }) {
  const { t } = useLanguage();
  const locator = item.sourceRange ? focusSourceLocator(item.sourceRange) : null;

  const body = (
    <>
      <span className="block text-xs leading-[1.5] font-medium text-foreground">{item.title}</span>
      <span className="block text-[11px] leading-[1.6] mt-1 text-muted-foreground">{item.detail}</span>
    </>
  );

  if (!locator) {
    return (
      <div
        data-testid="study-focus-item"
        className="rounded-xl border border-border-soft bg-[var(--glass-2)] px-2.5 py-2"
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="study-focus-item"
      aria-label={`${t("reader.studyFocusJumpAria")} · ${item.title}`}
      title={t("reader.studyFocusJumpAria")}
      onClick={() => onJump(locator)}
      className={cn(
        "text-left rounded-xl border border-border-soft bg-[var(--glass-2)] px-2.5 py-2",
        "cursor-pointer hover:bg-[var(--glass-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </button>
  );
}

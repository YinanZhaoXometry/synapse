/**
 * The materials-hub row's lesson parts (epic-36 T3 — the ① entry). Two
 * presentational pieces the row slots in at its tail (additive — the row's
 * own layout stays untouched):
 *
 * `MaterialLessonChips` — the AI 讲义 origin chip + the live generation-state
 * chip (进行中 / 已暂停可续, lessonRowState's derivation off the generation
 * jsonb verbatim). Renders nothing on an uploaded row.
 *
 * `MaterialLessonAction` — the row action: 「生成讲义」 opens the READ-ONLY
 * outline confirm popover (the ① gate: chapters + each chapter's source
 * sections + the estimate-function cost + remaining cap; 确认生成 echoes the
 * outline into createLesson — the page owns those calls — and 重出一版
 * re-rolls one call, replacing the content silently); an existing lesson
 * (the per-source singleton) deforms the action into 「打开讲义」; a generated
 * row shows 打开讲义 + the regenerate entry whose strong confirm (原位替换 +
 * 重烧 — the reader's exact copy keys) dispatches onRegenerate. Every click
 * stops propagation: the row's own navigation affordances must never fire
 * through the action.
 */
import { useState } from "react";
import { BookText, RotateCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MaterialView } from "@/api/views";
import { lessonRowState, type LessonGateReason } from "./lesson-entry";

/** One proposed outline chapter (the propose reply's vocabulary verbatim:
 * title + the source section ids it teaches — id/anchors/status are the
 * persisted outline's halves and never ride a proposal). */
export interface LessonOutlineProposal {
  title: string;
  sourceSectionIds: string[];
}

const ACTION_CLASS =
  "inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The origin + generation-state chips (spec story 15): AI 讲义 marks the
 * generated row; 进行中/已暂停可续 tell the hub user a generation is live or
 * resumable. Complete lessons render the origin chip alone. */
export function MaterialLessonChips({ material }: { material: MaterialView }) {
  const { t } = useLanguage();
  if (material.origin !== "generated") return null;
  const state = material.generation ? lessonRowState(material.generation) : null;
  return (
    <>
      <span
        data-testid="lesson-origin-chip"
        className="pill whitespace-nowrap bg-[var(--accent-tint)] text-accent-ink border border-[var(--accent-edge)]"
      >
        {t("materials.lessonChip")}
      </span>
      {state && (
        <span data-testid="lesson-state-chip" className="pill pill-muted whitespace-nowrap">
          {state === "paused" ? t("materials.lessonStatePaused") : t("materials.lessonStateActive")}
        </span>
      )}
    </>
  );
}

export function MaterialLessonAction({
  material,
  existingLessonId,
  gateReason,
  open,
  outline,
  proposing,
  outlineFailed,
  creating,
  costHint,
  onOpenChange,
  onConfirm,
  onReroll,
  onRegenerate,
}: {
  material: MaterialView;
  /** The per-source singleton's lesson id — present → the action deforms into
   * 「打开讲义」 (repeat entry OPENS, never a second create — spec story 11). */
  existingLessonId: string | null;
  /** The gate verdict (lessonGateReason) — null = actionable. */
  gateReason: LessonGateReason | null;
  /** The controlled popover state (the page owns it — one gate open at a time). */
  open: boolean;
  /** The proposed outline for THIS row while open (null = nothing yet). */
  outline: LessonOutlineProposal[] | null;
  /** The propose/re-roll call in flight (the loading state). */
  proposing: boolean;
  /** The propose call failed (the honest retry posture — a re-roll retries). */
  outlineFailed: boolean;
  /** The create call in flight (the confirm disables + names itself). */
  creating: boolean;
  /** lessonEntryHint's composition (estimate × remaining cap) — null while
   * either read is in flight; never a hand-written figure. */
  costHint: string | null;
  onOpenChange(open: boolean): void;
  /** 确认生成 — the page echoes the outline into createLesson and navigates. */
  onConfirm(): void;
  /** 重出一版 — one call, content replaced silently on success. */
  onReroll(): void;
  /** The lesson row's 重新生成 dispatch (the page navigates with the
   * one-shot regenerate command; the confirm lives HERE — 二次确认). */
  onRegenerate(): void;
}) {
  const { t } = useLanguage();
  const [regenOpen, setRegenOpen] = useState(false);
  const isLessonRow = material.origin === "generated";
  const hasLesson = isLessonRow || existingLessonId !== null;
  const disabled = !hasLesson && gateReason !== null;
  const gateCopy =
    gateReason === "parsing"
      ? t("materials.lessonGateParsing")
      : gateReason === "failed"
        ? t("materials.lessonGateFailed")
        : gateReason === "empty"
          ? t("materials.lessonGateEmpty")
          : null;

  const title = material.title;
  const label = hasLesson ? t("materials.lessonOpen") : t("materials.lessonAction");
  // The disabled gate's reason rides the aria-label too (review F6): the
  // tooltip-only posture was also tooltip-NEVER (pointer-events-none
  // suppresses it) — the reason renders as a visible sibling below, and AT
  // hears the action WITH its reason, not just its name.
  const aria = disabled && gateCopy
    ? t("materials.lessonActionGatedAria", { title, reason: gateCopy })
    : hasLesson
      ? t("materials.lessonOpenAria", { title })
      : t("materials.lessonActionAria", { title });

  return (
    <>
      {isLessonRow && (
        // The material-side regenerate entry (the ticket's 一致语义): the SAME
        // strong confirm the reader renders (原位替换 + 重烧额度 — one copy
        // source), then the page carries the one-shot command to the reader.
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRegenOpen(true);
            }}
            aria-label={t("materials.lessonRegenAria", { title })}
            data-testid="material-lesson-regen"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" /> {t("materials.lessonRegen")}
          </button>
          <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
            <DialogContent data-testid="lesson-regenerate-dialog" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-lg">{t("reader.lessonRegenerateTitle")}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground leading-[1.6]">{t("reader.lessonRegenerateBody")}</p>
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegenOpen(false)}
                  data-testid="lesson-regenerate-cancel"
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t("reader.lessonRegenerateCancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegenOpen(false);
                    onRegenerate();
                  }}
                  data-testid="lesson-regenerate-confirm"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:bg-[var(--accent-tint-2)]"
                >
                  {t("reader.lessonRegenerateConfirm")}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      <Popover open={open} onOpenChange={(next) => { if (!disabled) onOpenChange(next); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            aria-label={aria}
            aria-disabled={disabled || undefined}
            data-testid="material-lesson"
            className={cn(
              ACTION_CLASS,
              hasLesson
                ? "bg-[var(--glass-4)] border border-border hover:bg-[var(--glass-solid)]"
                : "bg-[var(--accent-tint)] border border-[var(--accent-edge)] text-accent-ink hover:bg-[var(--accent-tint-2)]",
              disabled && "opacity-40 pointer-events-none",
            )}
          >
            <BookText className="w-3 h-3" aria-hidden="true" /> {label}
          </button>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            data-testid="lesson-outline-confirm"
            align="end"
            className="w-[340px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {proposing && (
              <p data-testid="lesson-outline-loading" className="text-xs text-muted-foreground py-2">
                {t("materials.lessonOutlineProposing")}
              </p>
            )}
            {!proposing && outlineFailed && (
              <div data-testid="lesson-outline-error" className="flex flex-col gap-2 py-1">
                <p className="text-xs text-muted-foreground leading-[1.6]">{t("materials.lessonOutlineFailed")}</p>
                <button
                  type="button"
                  onClick={onReroll}
                  data-testid="lesson-outline-reroll"
                  className="self-start text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
                >
                  {t("materials.lessonOutlineReroll")}
                </button>
              </div>
            )}
            {!proposing && !outlineFailed && outline !== null && outline.length === 0 && (
              <div data-testid="lesson-outline-empty" className="flex flex-col gap-2 py-1">
                <p className="text-xs text-muted-foreground leading-[1.6]">{t("materials.lessonOutlineEmpty")}</p>
                <button
                  type="button"
                  onClick={onReroll}
                  data-testid="lesson-outline-reroll"
                  className="self-start text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
                >
                  {t("materials.lessonOutlineReroll")}
                </button>
              </div>
            )}
            {!proposing && !outlineFailed && outline !== null && outline.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="eyebrow">{t("materials.lessonOutlineTitle")}</p>
                {/* READ-ONLY by construction (spec story 8 — dissatisfaction
                    costs one call, not a UI lesson): plain text chapters, no
                    editor affordances anywhere. */}
                <ol className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                  {outline.map((chapter, index) => {
                    const sourceTitles = chapter.sourceSectionIds.map(
                      (sectionId) => material.sections.find((section) => section.id === sectionId)?.title ?? sectionId,
                    );
                    return (
                      <li key={`${index}-${chapter.title}`} data-testid="lesson-outline-chapter" className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold leading-[1.5]">
                          {t("materials.lessonOutlineChapterLabel", { n: index + 1 })} · {chapter.title}
                        </span>
                        <span data-testid="lesson-outline-chapter-source" className="text-[11px] text-muted-foreground leading-[1.5]">
                          {sourceTitles.join("、")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {costHint && (
                  <p data-testid="lesson-outline-cost" className="text-[11px] text-muted-foreground">
                    {costHint}
                  </p>
                )}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    data-testid="lesson-outline-cancel"
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {t("materials.lessonOutlineCancel")}
                  </button>
                  <button
                    type="button"
                    onClick={onReroll}
                    disabled={proposing || creating}
                    data-testid="lesson-outline-reroll"
                    className="text-xs text-muted-foreground cursor-pointer hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {t("materials.lessonOutlineReroll")}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={creating}
                    data-testid="lesson-outline-confirm-btn"
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:bg-[var(--accent-tint-2)] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {creating ? t("materials.lessonOutlineCreating") : t("materials.lessonOutlineConfirm")}
                  </button>
                </div>
              </div>
            )}
          </PopoverContent>
        )}
      </Popover>
      {disabled && gateCopy && (
        // The gate reason as a VISIBLE sibling (the node-lesson-hint
        // precedent, review F6): honesty on a disabled action never rides a
        // tooltip that pointer-events-none suppresses. Capped width keeps
        // the two-line row compact.
        <span
          data-testid="material-lesson-gate"
          className="flex-none max-w-[180px] text-[10px] leading-[1.4] text-muted-foreground"
        >
          {gateCopy}
        </span>
      )}
    </>
  );
}

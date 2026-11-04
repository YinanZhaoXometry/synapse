/**
 * FlashcardStudy (epic-6 T3; UX spine FlashcardStudy contract; FR-19; NFR-8):
 * flip-first study over the plan's persisted cards. The front ALWAYS renders
 * first and the back is ABSENT from the DOM until the flip — recall attempt
 * before reveal, enforced in render tests. Space or click flips, ←→ navigate
 * freely (rated cards keep their rating), Esc exits to the plan immediately —
 * safe by construction, because the difficulty trio 难 / 中 / 易 persists each
 * self-rating through the rating mutation the moment it is given (nothing of
 * value is lost: study state is deliberately stateless across reloads, spec
 * decision 7, and the summary says so). A revisit always shows the front
 * first — reveal is an action, not a state; the saved rating renders marked
 * and may be re-rated (latest wins). The queue's end lands on a summary with
 * the ratings breakdown, a back-to-plan action, and 再学一轮 restarting the
 * SAME queue (not regeneration). Zero SRS: no scheduling, no due dates, no
 * re-queue anywhere (FR-24 is Phase 2); ratings never create EvidenceRecords
 * (ADR-0001).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Eye, Info, Layers } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRateFlashcardMutation } from "@/api";
import { cn } from "@/lib/utils";
import type { Flashcard, Material } from "@/domain/entities";
import { flashcardSourceTitle, ratingBreakdown } from "./display-shaping";

export interface FlashcardStudyProps {
  /** The owner's deck in creation order (= material section order, AD-6). */
  cards: Flashcard[];
  /** The owner's materials — the cards' source line resolves against them. */
  materials: Material[];
  /** The summary's exit label — 「返回计划」 on plans, 「返回任务」 on tasks (T4). */
  backLabelKey?: string;
  /** Exit to the owner's home: Esc mid-deck and the summary's exit action. */
  onExit: () => void;
}

type Difficulty = "hard" | "medium" | "easy";

const TRIO = [
  { value: "hard", labelKey: "flashcards.study.hard", className: "diff-hard", testId: "flashcards-rate-hard" },
  { value: "medium", labelKey: "flashcards.study.medium", className: "diff-medium", testId: "flashcards-rate-medium" },
  { value: "easy", labelKey: "flashcards.study.easy", className: "diff-easy", testId: "flashcards-rate-easy" },
] as const;

export function FlashcardStudy({ cards, materials, backLabelKey = "flashcards.summary.backToPlan", onExit }: FlashcardStudyProps) {
  const { t } = useLanguage();
  const [rateCard] = useRateFlashcardMutation();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  // This mount's fresh ratings, merged over the props (the normalized cache
  // refresh confirms them): the trio's saved mark renders even before the
  // deck's persisted rows catch up.
  const [savedRatings, setSavedRatings] = useState<Record<string, Difficulty>>({});

  const total = cards.length;
  const safeIndex = Math.min(index, Math.max(total - 1, 0));
  const card = cards[safeIndex];

  const flip = () => {
    if (done) return;
    setFlipped((f) => !f);
  };

  const goNext = () => {
    if (done) return;
    if (safeIndex >= total - 1) {
      setDone(true);
      setFlipped(false);
      return;
    }
    setIndex(safeIndex + 1);
    setFlipped(false); // a revisit shows the FRONT first — reveal is an action, not a state
  };

  const goPrev = () => {
    if (done || safeIndex === 0) return;
    setIndex(safeIndex - 1);
    setFlipped(false);
  };

  /** Persist the self-rating, THEN advance (rating the last card ends the queue).
   * A failed write keeps the card flipped for retry — nothing is lost. */
  const rate = async (difficulty: Difficulty) => {
    if (done || !card) return;
    try {
      // self-rating only — no evidence (ADR-0001); no onError → a failure rejects
      await rateCard({ variables: { input: { id: card.id, difficulty } } });
    } catch {
      toast.error(t("flashcards.rateSaveFailed"));
      return;
    }
    setSavedRatings((prev) => ({ ...prev, [card.id]: difficulty }));
    goNext();
  };

  /** 再学一轮: restart the SAME queue from the first card — ratings stay. */
  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setDone(false);
  };

  // Keyboard map (UX spine): Space flip, ←→ navigate, Esc exit. Registered per
  // render so the handlers always close over the current state (scaffold demo
  // precedent); interactive targets handle themselves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (done) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, a, input, textarea, select")) return;
      if (event.key === " ") {
        event.preventDefault();
        flip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onExit(); // exit is immediate and safe — ratings already persist
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (total === 0) return null; // the route owns the no-cards state (the launcher)

  if (done) {
    const merged = cards.map((c) => (savedRatings[c.id] ? { ...c, difficulty: savedRatings[c.id] } : c));
    const breakdown = ratingBreakdown(merged);
    return (
      <div data-testid="flashcards-summary" className="mt-2">
        <p className="eyebrow">{t("flashcards.summary.eyebrow")}</p>
        <h1 className="page-title mt-1.5 text-lg">{t("flashcards.summary.title")}</h1>
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center">
          <Layers className="w-5 h-5 mx-auto text-accent-ink" aria-hidden="true" />
          <p className="text-sm font-semibold mt-3 tabular-nums">
            {t("flashcards.summary.breakdown", { n: breakdown.total, h: breakdown.hard, m: breakdown.medium, e: breakdown.easy })}
          </p>
          {breakdown.unrated > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
              {t("flashcards.summary.unrated", { u: breakdown.unrated })}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-4 leading-[1.6]">{t("flashcards.summary.selfRatingNote")}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-[1.6]">{t("flashcards.summary.statelessNote")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="flashcards-again"
              onClick={restart}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
            >
              {t("flashcards.summary.again")}
            </button>
            <button
              type="button"
              data-testid="flashcards-back-to-plan"
              onClick={onExit}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
            >
              {t(backLabelKey)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const saved = savedRatings[card.id] ?? card.difficulty;
  const sourceTitle = flashcardSourceTitle(card, materials);

  return (
    <div data-testid="flashcards-study">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("flashcards.study.eyebrow")}</p>
          <span className="pill mt-1.5 inline-flex" data-testid="flashcards-progress" aria-live="polite">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("flashcards.study.progress", { i: safeIndex + 1, n: total })}
          </span>
        </div>
      </div>

      {/* the card: click or Space flips — the back renders ONLY when flipped
          (NFR-8: absent from the DOM until the recall attempt is made) */}
      <div className="mx-auto mt-5 max-w-[680px]">
        <div
          role="button"
          tabIndex={0}
          data-testid="flashcards-card"
          onClick={flip}
          aria-label={flipped ? t("flashcards.study.backLabel") : t("flashcards.study.frontLabel")}
          className="flex min-h-[280px] cursor-pointer flex-col rounded-[20px] border border-border-soft bg-card p-8 text-left shadow-raised transition-shadow hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {flipped ? t("flashcards.study.backLabel") : t("flashcards.study.frontLabel")}
          </span>
          <span data-testid="flashcards-front" className="mt-4 font-display text-2xl leading-snug tracking-tight">
            {card.front}
          </span>
          {flipped ? (
            <div data-testid="flashcards-back" className="mt-5 border-t border-border-soft pt-5 text-[15px] leading-loose text-muted-foreground">
              {card.back}
              {sourceTitle && (
                <div className="mt-3">
                  <span className="citation">
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    {t("flashcards.study.source")} · {sourceTitle}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {t("flashcards.study.flipHint")}
            </div>
          )}
        </div>

        {/* deck dots: per-card self-rating state, never color alone (the count pill carries it too) */}
        <div className="mt-4 flex items-center gap-3">
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-muted-foreground">
            {t("flashcards.study.progress", { i: safeIndex + 1, n: total })}
          </span>
          <div className="flex flex-1 gap-1">
            {cards.map((c, idx) => (
              <span
                key={c.id}
                className={cn("deck-dot", (savedRatings[c.id] ?? c.difficulty) ? "done" : idx === safeIndex && "on")}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="flashcards-prev"
            onClick={goPrev}
            disabled={safeIndex === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("flashcards.study.prev")}
          </button>

          {flipped ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-2" role="group" aria-label={t("flashcards.study.rateLabel")}>
                {TRIO.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    data-testid={option.testId}
                    aria-pressed={saved === option.value}
                    onClick={() => void rate(option.value)}
                    className={cn(
                      "diff-btn",
                      option.className,
                      "cursor-pointer",
                      saved === option.value && "shadow-[0_0_0_3px_var(--accent-ring)]",
                    )}
                  >
                    {saved === option.value && <Check className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />}
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              {saved && (
                <span data-testid="flashcards-saved-rating" className="text-[10px] font-semibold text-muted-foreground">
                  {t("flashcards.study.savedRating")}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              data-testid="flashcards-flip"
              onClick={flip}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
            >
              {t("flashcards.study.flip")}
            </button>
          )}

          <button
            type="button"
            data-testid="flashcards-next"
            onClick={goNext}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.97] cursor-pointer"
          >
            {t("flashcards.study.next")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <p className="kbd-hint">
          <Info className="h-3 w-3 flex-none" aria-hidden="true" />
          {t("flashcards.study.keyboardHint")}
        </p>
      </div>
    </div>
  );
}

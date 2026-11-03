// Northstar prototype v2 port (docs/design/northstar-import/prototype-v2/app.js — renderFlashcards family).
// Deck: flip → prev/next → difficulty trio after flip → summary (ring + counts).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Eye, Info, Layers, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { FLASHCARDS, pickL } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/* ── Northstar button recipes (prototype .btn / .btn-primary / .btn-secondary / .btn-ghost) ── */
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnSm = "rounded-[10px] px-3.5 py-2 text-[13px]";

/* ── Score ring (prototype ringSvg: r=(size-stroke)/2, dashoffset, rotate -90°) ── */
function ScoreRing({ pct, value, label }: { pct: number; value: number; label: string }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative h-[132px] w-[132px] flex-none">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={`${Math.round(pct)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-[30px] font-semibold leading-none tabular-nums">{value}</b>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

type Difficulty = "hard" | "medium" | "easy";

export default function FlashcardsPage() {
  const { t, language } = useLanguage();
  const { reviewFlashcard } = useUserProgress();
  const navigate = useNavigate();

  /* Deck state (mirrors prototype state.flash) */
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Difficulty>>({});
  const [done, setDone] = useState(false);

  const n = FLASHCARDS.length;
  const card = FLASHCARDS[i];
  const reviewed = Object.keys(ratings).length;
  const easyCount = Object.values(ratings).filter(d => d === "easy").length;
  const pct = n ? Math.round((reviewed / n) * 100) : 0;

  /* ── Logic (prototype flipCard / flashNext / flashPrev / rateCard) ── */
  const flipCard = () => {
    if (done) return;
    setFlipped(f => !f);
  };

  const flashNext = () => {
    if (done) return;
    if (i >= n - 1) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setFlipped(false);
  };

  const flashPrev = () => {
    if (done || i === 0) return;
    setI(i - 1);
    setFlipped(false);
  };

  const rateCard = (diff: Difficulty) => {
    if (done) return;
    setRatings(r => ({ ...r, [card.id]: diff }));
    reviewFlashcard();
    if (i >= n - 1) {
      setDone(true);
    } else {
      setI(i + 1);
      setFlipped(false);
    }
  };

  const restartDeck = () => {
    setI(0);
    setFlipped(false);
    setRatings({});
    setDone(false);
  };

  /* ── Keyboard (prototype handleKeydown flashcards branch; rateCard increments context once per rating) ── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (done) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, a, input, textarea, select")) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        flipCard();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        flashNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        flashPrev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setDone(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (done) {
    /* ── Summary ── */
    return (
      <div className="p-6 md:p-8 max-w-[984px] mx-auto">
        <div>
          <p className="eyebrow">{t("flash.eyebrow")}</p>
          <h1 className="page-title">{t("flash.summaryTitle")}</h1>
        </div>
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing pct={pct} value={reviewed} label={t("flash.reviewed")} />
            <div className="min-w-[200px] flex-1">
              <h2 className="font-display text-2xl font-semibold tracking-tight">{t("flash.summaryCardTitle")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t("flash.summaryBody", { n: reviewed, easy: easyCount })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={restartDeck} className={btnPrimary}>
                  <RefreshCw className="h-4 w-4" />
                  {t("flash.again")}
                </button>
                <button type="button" onClick={() => navigate("/dashboard")} className={btnSecondary}>
                  {t("flash.backHome")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Deck ── */
  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("flash.eyebrow")}</p>
          <h1 className="page-title">{t("flash.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("flash.subtitle")}</p>
        </div>
        <span className="pill">
          <Layers className="h-3.5 w-3.5" />
          {t("flash.progress", { i: i + 1, n })}
        </span>
      </div>

      {/* deck-stage */}
      <div className="mx-auto mt-5 max-w-[680px]">
        <div
          role="button"
          tabIndex={0}
          onClick={flipCard}
          aria-label={flipped ? t("flash.back") : t("flash.flip")}
          className="flex min-h-[320px] cursor-pointer flex-col rounded-[20px] border border-border-soft bg-card p-8 text-left shadow-raised transition-shadow hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {flipped ? t("flash.back") : t("flash.front")}
          </span>
          <span className="mt-4 font-display text-2xl leading-snug tracking-tight">
            {pickL(card.prompt, language)}
          </span>
          {flipped ? (
            <div className="mt-5 border-t border-border-soft pt-5 text-[15px] leading-loose text-muted-foreground">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("flash.back")}
              </div>
              {pickL(card.answer, language)}
              <div>
                <span className="citation">
                  <BookOpen className="h-3 w-3" />
                  {t("flash.source")} · {pickL(card.source, language)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5 flex-none" />
              {t("flash.hint")}
            </div>
          )}
        </div>

        {/* deck-meta */}
        <div className="mt-4 flex items-center gap-3">
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-muted-foreground">
            {t("flash.progress", { i: i + 1, n })}
          </span>
          <div className="flex flex-1 gap-1">
            {FLASHCARDS.map((c, idx) => (
              <span key={c.id} className={cn("deck-dot", ratings[c.id] ? "done" : idx === i && "on")} />
            ))}
          </div>
        </div>

        {/* flash-foot */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={flashPrev} disabled={i === 0} className={cn(btnGhost, btnSm)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("flash.prev")}
          </button>
          {flipped ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => rateCard("hard")} className="diff-btn diff-hard">
                {t("flash.hard")}
              </button>
              <button type="button" onClick={() => rateCard("medium")} className="diff-btn diff-medium">
                {t("flash.medium")}
              </button>
              <button type="button" onClick={() => rateCard("easy")} className="diff-btn diff-easy">
                {t("flash.easy")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={flipCard} className={cn(btnPrimary, btnSm)}>
              {t("flash.flip")}
            </button>
          )}
          <button type="button" onClick={() => setDone(true)} className={cn(btnSecondary, btnSm)}>
            {t("flash.finish")}
          </button>
        </div>

        <p className="kbd-hint">
          <Info className="h-3 w-3 flex-none" />
          {flipped ? t("flash.rateFirst") : t("flash.spaceHint")}
        </p>
      </div>
    </div>
  );
}

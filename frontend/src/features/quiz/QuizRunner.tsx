/**
 * QuizRunner (epic-6 T2; UX spine QuizRunner contract): one question at a time
 * with 「Q n/total」 progress, the attempt gate enforced visually — the runner
 * renders ONLY the machine's views, so before submit/forfeit no answer,
 * rationale, or correct-option marking can exist in the output — choice
 * select + confirm, open textarea → 「对照材料评分中」 grading wait → verdict
 * with rationale + citation, the free outcome-neutral hint (the source section
 * title — never the explanation), forfeit (= 「看答案」, revealed as wrong),
 * and the keyboard map (1–4 select · Enter confirm/next · Esc exit-ask). Exit
 * asks once and abandons the session (not resumable, evidence never lands).
 * The verdict is a PACED step the runner owns: the machine auto-advances, the
 * UI pins the just-revealed question until Enter / 下一题 — pace belongs to
 * the user. A resumed session honestly announces 「从第 1 题继续」 (per-question
 * progress is not persisted — T1 contract).
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Info, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import ChatMarkdown from "@/components/shared/chat-markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { EvidenceRecord } from "@/domain/entities";
import type { MaterialView, KnowledgeNodeView } from "@/api/views";
import { quizHintFor } from "./display-shaping";
import { OUTCOME_STATUS } from "./outcome-status";
import { activeMaskedView, type MaskedQuestionView, type QuizRunState, type RevealedQuestionView } from "./session-machine";
import { QuizResults } from "./QuizResults";
import type { useQuizSession } from "./use-quiz-session";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:brightness-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 cursor-pointer";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.97] cursor-pointer";
const btnHint =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-[var(--accent-tint)] px-3.5 py-2 text-[13px] font-semibold text-accent-ink shadow-[inset_0_0_0_1px_var(--accent-ring)] transition-colors hover:brightness-95 active:scale-[0.97] disabled:opacity-50 cursor-pointer";
const iconBtn =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer";

export interface QuizRunnerProps {
  driver: ReturnType<typeof useQuizSession>;
  run: QuizRunState;
  /** The plan's materials — the hint's source-section title + results excerpts. */
  materials: MaterialView[];
  nodes: KnowledgeNodeView[];
  evidence: EvidenceRecord[];
  /** True when this run was hydrated from the URL (honest resume note). */
  resumed: boolean;
  /** 再来一轮 — offered only when this mount knows the launch params. */
  canRetake: boolean;
  /** The results' exit label — forwarded to QuizResults (T4 task parity). */
  backLabelKey?: string;
  onRetake: () => void;
  onBackToPlan: () => void;
  /** Exit-leave: the driver has abandoned the session; navigate away. */
  onAbandoned: () => void;
}

function isRevealed(view: RevealedQuestionView | MaskedQuestionView): view is RevealedQuestionView {
  return view.status === "submitted" || view.status === "graded" || view.status === "forfeited";
}

export function QuizRunner({
  driver,
  run,
  materials,
  nodes,
  evidence,
  resumed,
  canRetake,
  backLabelKey,
  onRetake,
  onBackToPlan,
  onAbandoned,
}: QuizRunnerProps) {
  const { t } = useLanguage();
  const [exitOpen, setExitOpen] = useState(false);
  // The verdict pacing step: the machine auto-advances on reveal; the runner
  // pins the just-revealed question until Enter / 下一题 (UX: pace belongs to
  // the user). Cleared by next() — the active question or the results show.
  const [verdictId, setVerdictId] = useState<string | null>(null);
  const prevActiveRef = useRef<string | null>(null);
  // The prompt container (role="heading"): markdown-rendered since epic-26 T1,
  // so the focus/scroll target is the wrapper, not a bare <h2>.
  const promptRef = useRef<HTMLDivElement>(null);

  const total = run.views.length;
  const active = activeMaskedView(run);
  const verdictView = verdictId ? run.views.find((v) => v.id === verdictId) : undefined;
  const verdict = verdictView && isRevealed(verdictView) ? verdictView : null;

  const next = () => setVerdictId(null);

  const confirm = () => {
    if (!active || active.status !== "answering") return;
    if (active.kind === "choice" && active.selectedOptionIndex === null) {
      toast(t("quiz.answerAll"));
      return;
    }
    if (active.kind === "open" && !active.draftAnswer.trim()) {
      toast(t("quiz.emptyAnswer"));
      return;
    }
    driver.submit();
  };

  const exit = () => {
    driver.abandon();
    onAbandoned();
  };

  // Pin the reveal: whenever the previously-active question becomes revealed
  // (choice auto-grade, open grading landing, forfeit), show it as the verdict.
  useEffect(() => {
    const prevId = prevActiveRef.current;
    prevActiveRef.current = active?.id ?? null;
    if (!prevId) return;
    const revealed = run.views.find((v) => v.id === prevId);
    if (revealed && isRevealed(revealed)) setVerdictId(prevId);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus moves question-to-question (a11y floor); the prompt h2 takes focus.
  useEffect(() => {
    if (verdictId) return;
    promptRef.current?.focus();
  }, [run.currentIndex, verdictId]);

  // Keyboard map (UX spine): 1–4 select · Enter confirm/next · Esc exit-ask.
  // Re-registered every render — the closures always see the current machine
  // state (the scaffold QuizPage pattern).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (exitOpen) return; // the dialog owns Esc (and everything else) while open
      if (verdict) {
        if (event.key === "Enter" && !(event.target as HTMLElement | null)?.closest?.("button")) {
          event.preventDefault();
          next();
        }
        return;
      }
      if (!active) return;
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      if (event.key === "Escape") {
        event.preventDefault();
        setExitOpen(true);
        return;
      }
      if (active.kind === "choice" && active.status === "answering" && !inField && /^[1-4]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (index < active.options.length) {
          event.preventDefault();
          driver.select(index);
        }
        return;
      }
      if (target?.closest?.("button")) return; // focused buttons handle their own Enter
      if (event.key === "Enter" && active.status === "answering" && (!inField || !event.shiftKey)) {
        event.preventDefault();
        confirm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // -- results (the run completed; the verdict pacing already happened) ---------
  if (run.status === "completed" && !verdict && driver.results) {
    return (
      <QuizResults
        results={driver.results}
        sessionId={run.sessionId}
        nodes={nodes}
        materials={materials}
        evidence={evidence}
        canRetake={canRetake}
        backLabelKey={backLabelKey}
        onBackToPlan={onBackToPlan}
        onRetake={onRetake}
      />
    );
  }

  // -- verdict pacing step -------------------------------------------------------
  const screen = verdict ? (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-verdict">
      <div className="mx-auto max-w-[720px]">
        <ProgressBar
          index={run.views.findIndex((v) => v.id === verdict.id)}
          total={total}
          answered
          onExit={() => setExitOpen(true)}
        />
        <div className="rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
          <RevealedBody view={verdict} />
          <div className="mt-4 flex justify-end">
            <button type="button" data-testid="quiz-next" onClick={next} className={btnPrimary} autoFocus>
              {run.status === "completed" ? t("quiz.finish") : t("quiz.next")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="kbd-hint">
          <Info className="h-3 w-3 flex-none" aria-hidden="true" />
          {t("quiz.keyboardHint")}
        </p>
      </div>
    </div>
  ) : (
    active && (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-runner">
        <div className="mx-auto max-w-[720px]">
          <ProgressBar index={run.currentIndex} total={total} answered={false} onExit={() => setExitOpen(true)} />

          {resumed && (
            <div
              className="mb-3 rounded-xl border border-[color:var(--accent-edge)] bg-[var(--accent-tint)] px-4 py-2.5 text-xs leading-[1.6]"
              data-testid="quiz-resumed-note"
            >
              <p className="font-semibold text-accent-ink">{t("quiz.runner.resumedNote")}</p>
              <p className="text-muted-foreground mt-0.5">{t("quiz.runner.resumedHint")}</p>
            </div>
          )}

          <div className="rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
            <span className="pill pill-muted">{active.kind === "open" ? t("quiz.typeOpen") : t("quiz.typeChoice")}</span>
            <div
              ref={promptRef}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              className="mt-3 font-display text-[23px] font-semibold leading-snug tracking-tight focus:outline-none chat-prose"
            >
              <ChatMarkdown text={active.prompt} />
            </div>

            {active.kind === "choice" ? (
              <div className="mt-5 flex flex-col gap-2" data-testid="quiz-options">
                {active.options.map((opt, i) => {
                  const selected = active.selectedOptionIndex === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => driver.select(i)}
                      aria-pressed={selected}
                      disabled={active.status !== "answering"}
                      data-testid={`quiz-option-${i}`}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left text-[15px] leading-normal transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active.status === "answering" && "hover:border-[color:var(--accent-edge)] hover:bg-secondary",
                        selected ? "border-primary shadow-[0_0_0_3px_var(--accent-ring)]" : "border-border-soft",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-px flex h-6 w-6 flex-none items-center justify-center rounded-[7px] border text-[11px] font-bold",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={active.draftAnswer}
                onChange={(e) => driver.typeAnswer(e.target.value)}
                placeholder={t("quiz.openPlaceholder")}
                aria-label={t("quiz.openPlaceholder")}
                disabled={active.status !== "answering"}
                autoFocus={active.status === "answering"}
                data-testid="quiz-open-input"
                className="mt-5 block min-h-[116px] w-full resize-y rounded-xl border border-border bg-[var(--glass-4)] p-3.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-default disabled:opacity-70"
              />
            )}

            {active.status === "grading" && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite" data-testid="quiz-grading">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("quiz.grading")}
              </div>
            )}

            {active.hintUsed && quizHintFor(active, materials) && (
              <div className="hint-box" data-testid="quiz-hint-box">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-partial-ink" aria-hidden="true" />
                <span>
                  <strong>{t("quiz.hintLabel")}：</strong>
                  {t("quiz.hintSection", { section: quizHintFor(active, materials) })}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {active.status === "answering" && (
                <>
                  <button type="button" onClick={() => driver.hint()} disabled={active.hintUsed} className={btnHint} data-testid="quiz-hint">
                    {t("quiz.hint")}
                  </button>
                  <button type="button" onClick={() => driver.forfeit()} className={btnGhost} data-testid="quiz-forfeit">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("quiz.reveal")}
                  </button>
                  <span className="flex-1" />
                  <button type="button" onClick={confirm} data-testid="quiz-confirm" className={btnPrimary}>
                    {active.kind === "open" ? t("quiz.submit") : t("quiz.confirm")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="kbd-hint">
            <Info className="h-3 w-3 flex-none" aria-hidden="true" />
            {t("quiz.keyboardHint")}
          </p>
        </div>
      </div>
    )
  );

  return (
    <>
      {screen}

      {/* Exit asks ONCE (spec story 15) → abandon: terminal, not resumable. */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-md rounded-xl border border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("quiz.exitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("quiz.exitBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px] border border-border bg-[var(--glass-4)] px-3.5 py-2 text-[13px] font-semibold cursor-pointer">
              {t("quiz.exitStay")}
            </AlertDialogCancel>
            <AlertDialogAction className={btnPrimary} onClick={exit} data-testid="quiz-exit-leave">
              {t("quiz.exitLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** 「Q n/total」 + the progress bar + the exit ask (quiz.exit). */
function ProgressBar({ index, total, answered, onExit }: { index: number; total: number; answered: boolean; onExit: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-caption" data-testid="quiz-progress">
        {t("quiz.question", { i: index + 1, n: total })}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--uncovered-fill))]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-hero transition-[width] duration-300"
          style={{ width: `${Math.round(((index + (answered ? 1 : 0)) / total) * 100)}%` }}
        />
      </div>
      <button type="button" onClick={onExit} aria-label={t("quiz.exit")} title={t("quiz.exit")} className={iconBtn} data-testid="quiz-exit">
        <X className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The revealed panel: verdict + rationale + citation — the gate is open. */
function RevealedBody({ view }: { view: RevealedQuestionView }) {
  const { t } = useLanguage();
  const status = OUTCOME_STATUS[view.outcome];
  // A forfeit shares the wrong visuals but reads as the amber 「看答案」 variant
  // (scaffold verdict.partial tone) — forfeit = wrong, marked differently.
  const tone = view.forfeited ? "partial" : view.outcome;
  const yourPick = view.kind === "choice" && view.userAnswer ? view.options.indexOf(view.userAnswer) : -1;
  return (
    <div className={cn("verdict", tone)} role="status" aria-live="polite">
      <div className="verdict-head">
        <span className={cn("pill", status.pill)} data-testid="quiz-verdict-label">
          {t(status.labelKey)}
          {view.forfeited && ` · ${t("quiz.forfeited")}`}
        </span>
      </div>

      {view.kind === "choice" && (
        <div className="mt-2 flex flex-col gap-1.5">
          {view.options.map((opt, i) => {
            const correct = i === view.correctOptionIndex;
            const yourWrong = i === yourPick && !correct;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] leading-[1.6]",
                  correct && "border-mastered bg-mastered-tint",
                  yourWrong && "border-destructive tint-danger",
                  !correct && !yourWrong && "border-border-soft text-muted-foreground",
                )}
              >
                {opt}
                {correct && <Check className="inline h-3.5 w-3.5 ml-1.5 text-mastered-ink" aria-hidden="true" />}
                {yourWrong && <X className="inline h-3.5 w-3.5 ml-1.5 text-danger-ink" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      )}

      {view.kind === "open" && (
        <p>
          <strong>{t("quiz.yourGiven")}：</strong>
          {view.userAnswer || "—"}
        </p>
      )}
      {view.grading && (
        <div>
          <strong>{t("quiz.why")}：</strong>
          <ChatMarkdown text={view.grading.rationale} />
        </div>
      )}
      {view.grading?.citation?.quote && (
        <p>
          <span className="font-semibold">{t("quiz.sourceQuote")}：</span>
          <span className="italic">「{view.grading.citation.quote}」</span>
        </p>
      )}
      <div>
        <strong>{t("quiz.reference")}：</strong>
        <ChatMarkdown text={view.explanation} />
      </div>
      {view.forfeited && <p>{t("quiz.verdictForfeit")}</p>}
    </div>
  );
}

/**
 * QuizResults (epic-6 T2; UX spine QuizResults contract): the score, the
 * per-question breakdown with source excerpts, each affected node's mastery
 * move, wrong answers as the mistakes the mutation logged, and the two exits
 * (back to plan / 再来一轮 — a fresh generated session, honestly labeled since
 * the simulated generator produces near-identical rounds). Every number flows
 * through the display-shaping selectors over the shipped domain functions —
 * the exact ADR-0001 behavior (window 5, cap-99 below the gate) renders as-is,
 * no display arithmetic (AD-6).
 */
import { ArrowLeft, BookOpen, Check, Info, RefreshCw, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { EvidenceRecord, Material, Outcome } from "@/domain/entities";
import type { KnowledgeNodeView } from "@/api/views";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { StateGlyph } from "@/features/plans";
import { cn } from "@/lib/utils";
import {
  quizBreakdownRows,
  quizMistakeViews,
  quizNodeRows,
  quizScoreSummary,
  type QuizBreakdownRow,
} from "./display-shaping";
import { OUTCOME_STATUS } from "./outcome-status";
import type { QuizAnswerResult } from "./session-machine";

export interface QuizResultsProps {
  results: QuizAnswerResult[];
  sessionId: string | null;
  nodes: KnowledgeNodeView[];
  /** The owner's materials — section titles for the source excerpts. */
  materials: Material[];
  /** Evidence queried AFTER the evidence mutation landed (fresh numbers). */
  evidence: EvidenceRecord[];
  /** 再来一轮 — only offered when this mount knows the launch params. */
  canRetake: boolean;
  /** The exit label — 「返回计划」 on plans, 「返回任务」 on tasks (T4). */
  backLabelKey?: string;
  onBackToPlan: () => void;
  onRetake: () => void;
}

export function QuizResults({
  results,
  sessionId,
  nodes,
  materials,
  evidence,
  canRetake,
  backLabelKey = "quiz.backToPlan",
  onBackToPlan,
  onRetake,
}: QuizResultsProps) {
  const { t } = useLanguage();
  const score = quizScoreSummary(results);
  const nodeRows = quizNodeRows(results, nodes, evidence);
  const breakdown = quizBreakdownRows(results, materials);
  const mistakes = quizMistakeViews(results, materials);
  // Review P2-1: the evidence claim derives from the real records this screen
  // already holds (queried fresh after the mutation lands) — never from the
  // machine's in-memory results, so a failed write can never show a logged lie.
  const sessionEvidenceCount = evidence.filter((e) => e.sessionId === sessionId).length;

  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="quiz-results">
      <p className="eyebrow">{t("quiz.resultsEyebrow")}</p>
      <h1 className="page-title mt-1">{t("quiz.resultsTitle")}</h1>

      {/* score card */}
      <div className="mt-4 rounded-2xl border border-border-soft bg-card p-6 shadow-raised">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <MasteryBadge percent={score.percent} />
          <div className="min-w-[200px] flex-1">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("quiz.resultsSub", { c: score.correct, p: score.partial, n: score.total })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sessionEvidenceCount > 0 ? (
                <span className="pill pill-mastered">
                  <Check className="h-[13px] w-[13px]" aria-hidden="true" />
                  {t("quiz.evidenceLogged", { n: sessionEvidenceCount })}
                </span>
              ) : (
                <span className="pill pill-muted">{t("quiz.evidencePending")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {canRetake && (
            <button
              type="button"
              data-testid="quiz-retake"
              onClick={onRetake}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("quiz.retry")}
            </button>
          )}
          <button
            type="button"
            data-testid="quiz-back-to-plan"
            onClick={onBackToPlan}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t(backLabelKey)}
          </button>
        </div>
        {canRetake && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-[1.5] text-muted-foreground">
            <Info className="h-3 w-3 flex-none" aria-hidden="true" />
            {t("quiz.retakeNote")}
          </p>
        )}
      </div>

      {/* mastery movement — the moment evidence lands (FR-3) */}
      <h2 className="mt-8 text-base font-semibold tracking-tight">{t("quiz.masteryDeltas")}</h2>
      <div className="mt-3 rounded-2xl border border-border-soft bg-card shadow-raised divide-y divide-border-soft">
        {nodeRows.map((row) => (
          <div key={row.nodeId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
            <StateGlyph state={row.state} />
            <span className="text-sm font-medium truncate flex-1 min-w-[120px]">{row.title}</span>
            {/* SERVER score (AD-14): the api's number for this node now */}
            <span
              className="text-[13px] tabular-nums text-muted-foreground whitespace-nowrap"
              aria-label={t("quiz.moveAria", { score: row.score })}
            >
              <b className="font-display font-bold">{row.score}%</b>
            </span>
            <OutcomeMarks outcomes={row.lastOutcomes} />
            {row.belowGate && (
              <p className="basis-full text-[11px] leading-[1.5] text-muted-foreground">
                {t("quiz.cap99Note", { n: MASTERY_CONFIG.evidenceGate })}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* per-question breakdown with source excerpts */}
      <h2 className="mt-8 text-base font-semibold tracking-tight">{t("quiz.breakdownTitle")}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {breakdown.map((row, i) => (
          <BreakdownCard key={row.result.questionId} row={row} index={i} />
        ))}
      </div>

      {/* wrong answers as the mistakes the mutation logged */}
      <h2 className="mt-8 text-base font-semibold tracking-tight">{t("quiz.mistakesTitle")}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {mistakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("quiz.noMistakes")}</p>
        ) : (
          mistakes.map((m) => (
            <article key={m.questionId} className="rounded-2xl border border-border-soft bg-card p-5 shadow-raised">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="pill">{m.kind === "open" ? t("quiz.typeOpen") : t("quiz.typeChoice")}</span>
                {m.forfeited && <span className="pill pill-muted">{t("quiz.forfeited")}</span>}
              </div>
              <h3 className="mt-2 text-[15px] font-semibold leading-snug">{m.prompt}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="compare-box compare-wrong">
                  <div className="compare-label">
                    <X className="h-3 w-3" aria-hidden="true" />
                    {t("quiz.yourGiven")}
                  </div>
                  {m.userAnswer || "—"}
                </div>
                <div className="compare-box compare-right">
                  <div className="compare-label">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    {t("quiz.correctAnswer")}
                  </div>
                  {m.correctAnswer}
                </div>
              </div>
              <div className="ai-note">
                <Sparkles className="mt-0.5 h-[15px] w-[15px] flex-none text-accent-ink" aria-hidden="true" />
                <span>
                  <strong>{t("quiz.why")}：</strong>
                  {m.note}
                </span>
              </div>
              {m.sectionTitle && <SourceLine sectionTitle={m.sectionTitle} quote={null} />}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

/** The round percentage as a compact filled bar (no ring needed at this size). */
function MasteryBadge({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-3 flex-none" data-testid="quiz-score">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${percent}%`}>
        <circle cx="42" cy="42" r="34" fill="none" stroke="hsl(var(--uncovered-fill))" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(2 * Math.PI * 34 * percent) / 100} ${2 * Math.PI * 34}`}
          transform={`rotate(-90 42 42)`}
        />
        <text
          x="50%"
          y="54%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontSize="19"
          className="font-display font-bold tabular-nums"
        >
          {percent}%
        </text>
      </svg>
    </div>
  );
}

const MARK: Record<Outcome, string> = { correct: "●", partial: "◐", wrong: "✕" };

/** The window's outcome marks — glyph + sr-only label, never color alone. */
function OutcomeMarks({ outcomes }: { outcomes: Outcome[] }) {
  const { t } = useLanguage();
  return (
    <span className="flex items-center gap-1 flex-none">
      {outcomes.map((outcome, i) => (
        <span key={`${outcome}-${i}`} className={cn("text-[10px] font-bold", OUTCOME_STATUS[outcome].ink)} aria-hidden="true">
          {MARK[outcome]}
        </span>
      ))}
      <span className="sr-only">
        {outcomes.map((o) => t(OUTCOME_STATUS[o].labelKey)).join(", ")}
      </span>
    </span>
  );
}

/** One breakdown card: verdict + rationale + source excerpt (UX spine). */
function BreakdownCard({ row, index }: { row: QuizBreakdownRow; index: number }) {
  const { t } = useLanguage();
  const r = row.result;
  const status = OUTCOME_STATUS[r.outcome];
  const yourPick = r.kind === "choice" && r.userAnswer ? r.options.indexOf(r.userAnswer) : -1;
  return (
    <article className="rounded-2xl border border-border-soft bg-card p-5 shadow-raised">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("pill", status.pill)}>
          {t(status.labelKey)}
          {r.forfeited && ` · ${t("quiz.forfeited")}`}
        </span>
        <span className="pill pill-muted">{r.kind === "open" ? t("quiz.typeOpen") : t("quiz.typeChoice")}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug">{r.prompt}</h3>

      {r.kind === "choice" ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {r.options.map((opt, i) => {
            const correct = i === r.correctOptionIndex;
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
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="compare-box compare-wrong">
            <div className="compare-label">{t("quiz.yourGiven")}</div>
            {r.userAnswer || "—"}
          </div>
          <div className="compare-box compare-right">
            <div className="compare-label">{t("quiz.reference")}</div>
            {r.explanation}
          </div>
        </div>
      )}

      {r.grading && (
        <div className="ai-note">
          <Sparkles className="mt-0.5 h-[15px] w-[15px] flex-none text-accent-ink" aria-hidden="true" />
          <span>
            <strong>{t("quiz.why")}：</strong>
            {r.grading.rationale}
          </span>
        </div>
      )}
      {row.sectionTitle && <SourceLine sectionTitle={row.sectionTitle} quote={row.quote} />}
    </article>
  );
}

/** The source excerpt line: section title + the grader's quote when carried. */
function SourceLine({ sectionTitle, quote }: { sectionTitle: string; quote: string | null }) {
  const { t } = useLanguage();
  return (
    <div className="citation mt-2">
      <BookOpen className="h-3 w-3 flex-none" aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-semibold">{sectionTitle}</span>
        {quote && (
          <>
            {" — "}
            <span>{t("quiz.sourceQuote")}：</span>
            <span className="italic">「{quote}」</span>
          </>
        )}
      </span>
    </div>
  );
}

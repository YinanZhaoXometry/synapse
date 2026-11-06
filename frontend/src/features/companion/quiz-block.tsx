/**
 * The companion's inline quiz block (epic-24 T4): the interactive half of a
 * ```synapse-quiz reply. Choice = single-select options + submit; short =
 * free-text + submit (keyword-graded — the same "how many key terms did the
 * answer use" lens the server's open-answer grader applies, evaluated
 * client-side against the payload's own keywords). After submit the block
 * locks and reveals the verdict, the correct answer, and the explanation.
 *
 * NFR-8 law: NOTHING about the answer renders before an attempt — the
 * answer/explanation fields exist in the payload but pre-submit the block
 * shows only the question and the attempt inputs (asserted in tests).
 * Presentational + local state: the transcript entry stays the shaped text;
 * a restored thread re-parses the fence and mounts a fresh block.
 */
import { useState } from "react";
import { CheckCircle2, CircleHelp, ListChecks, XCircle } from "lucide-react";
import type { CompanionQuiz } from "@/ai/quiz";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/** Keyword coverage for short answers: ≥1 term hit = the attempt landed on
 * the right track (0 hits = try again against the reference — wording may
 * legitimately differ, so the copy never calls it flat-out wrong). */
function keywordHits(quiz: CompanionQuiz, draft: string): number {
  const normalized = draft.trim().toLowerCase();
  return (quiz.keywords ?? []).filter((keyword) => normalized.includes(keyword.trim().toLowerCase())).length;
}

export function QuizBlock({ quiz }: { quiz: CompanionQuiz }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const choice = quiz.kind === "choice";
  const canSubmit = choice ? selected !== null : draft.trim().length > 0;
  const choiceCorrect = choice && selected === quiz.answer;
  const shortHits = !choice && submitted ? keywordHits(quiz, draft) : 0;
  const shortCorrect = !choice && submitted && shortHits > 0;

  const submit = () => {
    if (canSubmit && !submitted) setSubmitted(true);
  };

  return (
    <div
      data-testid="companion-quiz-block"
      className="mt-2.5 rounded-xl border border-border bg-[var(--glass-2)] p-3"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
        <ListChecks className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
        {choice ? t("companion.quizChoice") : t("companion.quizShort")}
      </div>
      <p className="mt-1.5 text-[13px] leading-[1.6] whitespace-pre-wrap">{quiz.question}</p>

      {choice ? (
        <div role="radiogroup" aria-label={t("companion.quizChoice")} className="mt-2 flex flex-col gap-1.5">
          {(quiz.options ?? []).map((option, i) => {
            const picked = selected === i;
            const revealCorrect = submitted && i === quiz.answer;
            const revealWrongPick = submitted && picked && i !== quiz.answer;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={picked}
                data-testid={`quiz-block-option-${i}`}
                disabled={submitted}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] leading-[1.5] transition-colors text-start",
                  submitted ? "cursor-default" : "cursor-pointer hover:border-[color:var(--accent-edge)] hover:bg-[var(--glass-3)]",
                  picked && !submitted && "border-[color:var(--accent-edge)] bg-[var(--accent-tint)]",
                  revealCorrect && "border-mastered bg-mastered-tint text-mastered-ink",
                  revealWrongPick && "border-[var(--danger-ink)] text-danger-ink",
                  !picked && !revealCorrect && !revealWrongPick && "border-border",
                )}
              >
                <span aria-hidden="true" className="w-4 text-center text-[11px] font-semibold text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
                {revealCorrect && <CheckCircle2 className="w-4 h-4 flex-none" aria-hidden="true" />}
                {revealWrongPick && <XCircle className="w-4 h-4 flex-none" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          data-testid="quiz-block-short-input"
          aria-label={t("companion.quizShort")}
          value={draft}
          disabled={submitted}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("companion.quizShortPlaceholder")}
          rows={3}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] leading-[1.6] placeholder:text-caption-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        />
      )}

      {!submitted && (
        <button
          type="button"
          data-testid="quiz-block-submit"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-2.5 inline-flex items-center justify-center rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:brightness-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none"
        >
          {t("companion.quizSubmit")}
        </button>
      )}

      {submitted && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <span
            data-testid="quiz-block-verdict"
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold",
              (choiceCorrect || shortCorrect)
                ? "bg-mastered-tint text-mastered-ink"
                : "bg-[var(--glass-3)] text-muted-foreground",
            )}
          >
            {choiceCorrect || shortCorrect ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t("companion.quizCorrect")}
              </>
            ) : (
              <>
                <CircleHelp className="w-3.5 h-3.5" aria-hidden="true" />
                {choice ? t("companion.quizWrong") : t("companion.quizShortMiss", { hits: shortHits, total: quiz.keywords?.length ?? 0 })}
              </>
            )}
          </span>
          <p className="text-[12px] leading-[1.6]">
            <span className="font-semibold text-muted-foreground">{choice ? t("companion.quizCorrectAnswer") : t("companion.quizReference")}</span>
            <span className="ms-1.5">{choice ? quiz.options?.[quiz.answer ?? 0] : quiz.answerText}</span>
          </p>
          {(quiz.explanation ?? "").trim().length > 0 && (
            <p className="text-[12px] leading-[1.6] text-muted-foreground">{quiz.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

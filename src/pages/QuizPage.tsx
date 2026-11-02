// Northstar prototype v2 port (docs/design/northstar-import/prototype-v2/app.js — renderQuiz family).
// Quiz machine: start → runner (choice + open, hint, forfeit reveal, keyword grading) → results.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress, type MasteryDelta } from "@/contexts/UserProgressContext";
import { QUIZ_BANK, TOPICS, pickL, type MasteryTopic, type QuizQuestion } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/* ── Northstar button recipes (prototype .btn / .btn-primary / .btn-secondary / .btn-ghost) ── */
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass-4)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnSm = "rounded-[10px] px-3.5 py-2 text-[13px]";
const btnHint =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-[var(--accent-tint)] px-3.5 py-2 text-[13px] font-semibold text-accent-ink shadow-[inset_0_0_0_1px_var(--accent-ring)] transition-colors hover:bg-[var(--accent-tint)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const iconBtn =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

/* ── Mistake card (prototype mistakeCard — ai-note label is mistakes.analysis) ── */
function MistakeCard(props: {
  topic: string;
  question: string;
  given: string;
  correct: string;
  note: string;
  source: string;
}) {
  const { t } = useLanguage();
  return (
    <article className="rounded-2xl border border-border-soft bg-card p-5 shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="pill">{props.topic}</span>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug">{props.question}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="compare-box compare-wrong">
          <div className="compare-label">
            <X className="h-3 w-3" />
            {t("mistakes.yourAnswer")}
          </div>
          {props.given}
        </div>
        <div className="compare-box compare-right">
          <div className="compare-label">
            <Check className="h-3 w-3" />
            {t("mistakes.correctAnswer")}
          </div>
          {props.correct}
        </div>
      </div>
      <div className="ai-note">
        <Sparkles className="mt-0.5 h-[15px] w-[15px] flex-none text-accent-ink" />
        <span>
          <strong>{t("mistakes.analysis")}：</strong>
          {props.note}
        </span>
      </div>
      <span className="citation">
        <BookOpen className="h-3 w-3" />
        {props.source}
      </span>
    </article>
  );
}

/* ── Quiz state (mirrors prototype state.quiz) ── */
interface QuizAnswer {
  qid: string;
  given: string;
  correct: boolean;
  partial: boolean;
  forfeit: boolean;
}

interface QuizResults {
  score: number;
  correct: number;
  partial: number;
  total: number;
  deltas: MasteryDelta[];
  answers: QuizAnswer[];
  questions: QuizQuestion[];
}

interface QuizState {
  phase: "start" | "running" | "results";
  generating: boolean;
  questions: QuizQuestion[];
  i: number;
  selected: number | null;
  revealed: boolean;
  hint: boolean;
  input: string;
  grading: boolean;
  lastAnswer: QuizAnswer | null;
  answers: QuizAnswer[];
  results: QuizResults | null;
}

function freshQuizState(): QuizState {
  return {
    phase: "start",
    generating: false,
    questions: [],
    i: 0,
    selected: null,
    revealed: false,
    hint: false,
    input: "",
    grading: false,
    lastAnswer: null,
    answers: [],
    results: null,
  };
}

/* Fisher–Yates shuffle of the quiz bank (prototype startQuiz). */
function shuffledBank(): QuizQuestion[] {
  const questions = QUIZ_BANK.slice();
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = questions[i];
    questions[i] = questions[j];
    questions[j] = tmp;
  }
  return questions;
}

export default function QuizPage() {
  const { t, language } = useLanguage();
  const { mastery, applyQuizOutcome } = useUserProgress();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizState>(freshQuizState);
  const [exitOpen, setExitOpen] = useState(false);

  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  const promptRef = useRef<HTMLHeadingElement>(null);
  const gradingTimer = useRef<number | null>(null);
  const generateTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (gradingTimer.current != null) window.clearTimeout(gradingTimer.current);
      if (generateTimer.current != null) window.clearTimeout(generateTimer.current);
    },
    [],
  );

  /* Focus the prompt on question change (prototype focusQuestion). */
  useEffect(() => {
    if (quiz.phase === "running") promptRef.current?.focus();
  }, [quiz.phase, quiz.i]);

  /* Scroll to top when results land (prototype viewEl.scrollTop = 0). */
  useEffect(() => {
    if (quiz.phase === "results") window.scrollTo({ top: 0 });
  }, [quiz.phase]);

  /* Guard: running with no questions → back to start (prototype renderQuizRunner). */
  useEffect(() => {
    if (quiz.phase === "running" && !quiz.questions.length) setQuiz(freshQuizState());
  }, [quiz.phase, quiz.questions.length]);

  /* ── Logic (prototype startQuiz / selectOption / confirmQuiz / forfeitQuiz / nextQuiz / finishQuiz) ── */
  const startQuiz = () => {
    setQuiz({ ...freshQuizState(), phase: "running", questions: shuffledBank() });
  };

  const generateQuiz = () => {
    if (quizRef.current.generating) return;
    setQuiz({ ...quizRef.current, generating: true });
    generateTimer.current = window.setTimeout(() => {
      setQuiz(cur => ({ ...cur, generating: false }));
      toast(t("quiz.generated"));
    }, 1200);
  };

  const selectOption = (index: number) => {
    const s = quizRef.current;
    const q = s.questions[s.i];
    if (s.phase !== "running" || !q || q.type !== "choice" || s.revealed || s.grading) return;
    if (index < 0 || index >= (q.options?.length ?? 0)) return;
    setQuiz({ ...s, selected: index });
  };

  const confirmQuiz = () => {
    const s = quizRef.current;
    const q = s.questions[s.i];
    if (s.phase !== "running" || !q || s.revealed || s.grading) return;
    if (q.type === "choice") {
      if (s.selected == null) {
        toast(t("quiz.answerAll"));
        return;
      }
      const answer: QuizAnswer = {
        qid: q.id,
        given: pickL(q.options?.[s.selected], language),
        correct: s.selected === q.answer,
        partial: false,
        forfeit: false,
      };
      setQuiz({ ...s, answers: [...s.answers, answer], lastAnswer: answer, revealed: true });
      return;
    }
    if (!s.input.trim()) {
      toast(t("quiz.emptyAnswer"));
      return;
    }
    const text = s.input;
    setQuiz({ ...s, grading: true });
    gradingTimer.current = window.setTimeout(() => {
      const cur = quizRef.current;
      if (cur.phase !== "running" || !cur.grading) return;
      const kws = q.keywords ? q.keywords[language] || q.keywords.zh : [];
      const hay = text.toLowerCase();
      let hits = 0;
      kws.forEach(k => {
        if (hay.indexOf(k.toLowerCase()) >= 0) hits++;
      });
      const partial = hits === 1;
      const correct = hits >= 2;
      const answer: QuizAnswer = { qid: q.id, given: text, correct, partial: partial && !correct, forfeit: false };
      setQuiz({ ...cur, answers: [...cur.answers, answer], lastAnswer: answer, revealed: true, grading: false });
    }, 900);
  };

  const forfeitQuiz = () => {
    const s = quizRef.current;
    const q = s.questions[s.i];
    if (s.phase !== "running" || !q || s.revealed || s.grading) return;
    const answer: QuizAnswer = { qid: q.id, given: s.input || "", correct: false, partial: false, forfeit: true };
    setQuiz({ ...s, answers: [...s.answers, answer], lastAnswer: answer, revealed: true });
  };

  const finishQuiz = () => {
    const s = quizRef.current;
    const answers = s.answers;
    const questions = s.questions;
    const correct = answers.filter(a => a.correct).length;
    const partial = answers.filter(a => a.partial).length;
    const score = Math.round(((correct + partial * 0.5) / questions.length) * 100);

    const deltas: MasteryDelta[] = [];
    (Object.keys(TOPICS) as MasteryTopic[]).forEach(topic => {
      const topicAnswers = answers.filter(a => {
        const q = questions.find(item => item.id === a.qid);
        return q && q.topicKey === topic;
      });
      if (!topicAnswers.length) return;
      let inc = 0;
      topicAnswers.forEach(a => {
        if (a.correct) inc += 6;
        else if (a.partial) inc += 3;
      });
      const before = mastery[topic];
      const after = Math.min(100, before + inc);
      if (after > before) deltas.push({ topic, from: before, to: after });
    });

    applyQuizOutcome({ correct, total: questions.length, deltas });
    setQuiz({
      ...s,
      phase: "results",
      results: { score, correct, partial, total: questions.length, deltas, answers, questions },
    });
  };

  const nextQuiz = () => {
    const s = quizRef.current;
    if (s.phase !== "running") return;
    if (s.i < s.questions.length - 1) {
      setQuiz({
        ...s,
        i: s.i + 1,
        selected: null,
        revealed: false,
        hint: false,
        input: "",
        grading: false,
        lastAnswer: null,
      });
    } else {
      finishQuiz();
    }
  };

  const exitQuiz = () => {
    setQuiz(freshQuizState());
    navigate("/dashboard");
  };

  /* ── Keyboard (prototype handleKeydown quiz branch) ── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (exitOpen) return;
      const s = quiz;
      if (s.phase !== "running") return;
      const q = s.questions[s.i];
      if (!q) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === "TEXTAREA" || tag === "INPUT";

      if (event.key === "Escape") {
        event.preventDefault();
        setExitOpen(true);
        return;
      }
      if (inField) {
        if (event.key === "Enter" && !event.shiftKey && !s.revealed && !s.grading) {
          event.preventDefault();
          confirmQuiz();
        }
        return;
      }
      if (q.type === "choice" && !s.revealed && !s.grading && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        selectOption(Number(event.key) - 1);
        return;
      }
      if (target?.closest?.("button") && event.key === "Enter") return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (s.revealed) nextQuiz();
        else confirmQuiz();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /* ── Start ── */
  if (quiz.phase === "start") {
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto">
        <div>
          <p className="eyebrow">{t("quiz.eyebrow")}</p>
          <h1 className="page-title">{t("quiz.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("quiz.subtitle")}</p>
        </div>
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t("quiz.startTitle")}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("quiz.startBody")}</p>
          <div className="my-5 flex flex-wrap gap-2">
            <span className="pill">
              <HelpCircle className="h-[13px] w-[13px]" />
              {t("quiz.metaCount")}
            </span>
            <span className="pill">
              <Layers className="h-[13px] w-[13px]" />
              {t("quiz.metaMode")}
            </span>
            <span className="pill">
              <Sparkles className="h-[13px] w-[13px]" />
              {t("quiz.metaHint")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={startQuiz} className={btnPrimary}>
              {t("quiz.start")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={generateQuiz} disabled={quiz.generating} className={btnSecondary}>
              {quiz.generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("quiz.generating")}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {t("quiz.generate")}
                </>
              )}
            </button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-caption">
            <Info className="h-[15px] w-[15px] flex-none" />
            {t("quiz.startNote")}
          </p>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  if (quiz.phase === "results" && quiz.results) {
    const r = quiz.results;
    const wrong = r.answers.filter(a => !a.correct && !a.partial);
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto">
        <div>
          <p className="eyebrow">{t("quiz.eyebrow")}</p>
          <h1 className="page-title">{t("quiz.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("quiz.resultsHead")}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing pct={r.score} value={r.score} label={t("quiz.score")} />
            <div className="min-w-[200px] flex-1">
              <p className="eyebrow">{t("quiz.resultsEyebrow")}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{t("quiz.resultsTitle")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t("quiz.resultsSub", { c: r.correct, p: r.partial, n: r.total })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="pill">
                  <Check className="h-[13px] w-[13px]" />
                  {t("quiz.evidenceLogged", { n: r.total })}
                </span>
                <span className="pill">{t("quiz.metaMode")}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={startQuiz} className={btnPrimary}>
                  <RefreshCw className="h-4 w-4" />
                  {t("quiz.retry")}
                </button>
                <button type="button" onClick={() => navigate("/dashboard")} className={btnSecondary}>
                  {t("quiz.backHome")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <h2 className="mt-8 text-base font-semibold tracking-tight">{t("quiz.masteryDeltas")}</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {r.deltas.length ? (
            r.deltas.map(d => {
              const mastered = d.to >= 80;
              return (
                <div
                  key={d.topic}
                  className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-card px-3 py-2.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 flex-none items-center justify-center rounded-md text-[10px] font-bold",
                      mastered ? "g-mastered" : "g-partial",
                    )}
                  >
                    {mastered ? "●" : "◐"}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{pickL(TOPICS[d.topic], language)}</span>
                  <span className="whitespace-nowrap tabular-nums text-muted-foreground">{d.from}%</span>
                  <span className="whitespace-nowrap font-bold tabular-nums text-mastered-ink">→ {d.to}%</span>
                  <span className={cn("pill", mastered ? "pill-mastered" : "pill-partial")}>
                    {mastered ? t("quiz.nodeMastered") : t("quiz.nodePartial")}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">{t("quiz.noChange")}</p>
          )}
        </div>

        <h2 className="mt-8 text-base font-semibold tracking-tight">{t("quiz.mistakesTitle")}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {wrong.length ? (
            wrong.map(a => {
              const q = r.questions.find(item => item.id === a.qid);
              if (!q) return null;
              const correctText =
                q.type === "choice" ? pickL(q.options?.[q.answer], language) : pickL(q.reference, language);
              const givenText = a.forfeit ? t("quiz.forfeited") : a.given || "—";
              return (
                <MistakeCard
                  key={a.qid}
                  topic={pickL(TOPICS[q.topicKey], language)}
                  question={pickL(q.prompt, language)}
                  given={givenText}
                  correct={correctText}
                  note={pickL(q.why, language)}
                  source={pickL(q.source, language)}
                />
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">{t("quiz.noMistakes")}</p>
          )}
        </div>
      </div>
    );
  }

  /* ── Runner ── */
  const q = quiz.questions[quiz.i];
  if (!q) return null;
  const total = quiz.questions.length;
  const idx = quiz.i;
  const answered = quiz.revealed;
  const answer = quiz.lastAnswer;

  let verdictClass = "";
  let verdictIcon: ReactNode = null;
  let verdictLabel = "";
  if (answered && answer) {
    verdictClass = answer.forfeit ? "partial" : answer.correct ? "correct" : answer.partial ? "partial" : "wrong";
    verdictIcon = answer.forfeit ? (
      <Eye className="h-[18px] w-[18px]" />
    ) : answer.correct ? (
      <Check className="h-[18px] w-[18px]" />
    ) : answer.partial ? (
      <Info className="h-[18px] w-[18px]" />
    ) : (
      <X className="h-[18px] w-[18px]" />
    );
    verdictLabel = answer.forfeit
      ? t("quiz.forfeited")
      : answer.correct
        ? t("quiz.correct")
        : answer.partial
          ? t("quiz.partial")
          : t("quiz.wrong");
  }

  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto">
      <div className="mx-auto max-w-[720px]">
        {/* q-progress */}
        <div className="mb-4 flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-caption">
            {t("quiz.question", { i: idx + 1, n: total })}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--uncovered-fill))]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-gradient-hero transition-[width] duration-300"
              style={{ width: `${Math.round(((idx + (answered ? 1 : 0)) / total) * 100)}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setExitOpen(true)}
            aria-label={t("quiz.exit")}
            title={t("quiz.exit")}
            className={iconBtn}
          >
            <X className="h-[19px] w-[19px]" />
          </button>
        </div>

        {/* q-card */}
        <div className="rounded-2xl border border-border-soft bg-card p-8 shadow-raised">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {pickL(TOPICS[q.topicKey], language)}
            </span>
            <span className="pill pill-muted">{q.type === "open" ? t("quiz.typeOpen") : t("quiz.typeChoice")}</span>
          </div>
          <h2
            ref={promptRef}
            tabIndex={-1}
            className="mt-3 font-display text-[23px] font-semibold leading-snug tracking-tight focus:outline-none"
          >
            {pickL(q.prompt, language)}
          </h2>

          {q.type === "choice" ? (
            <div className="mt-5 flex flex-col gap-2">
              {q.options?.map((opt, i) => {
                const isCorrect = answered && i === q.answer;
                const isSelectedWrong = answered && quiz.selected === i && i !== q.answer;
                const isSelectedForfeit = isSelectedWrong && answer?.forfeit;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectOption(i)}
                    aria-pressed={quiz.selected === i}
                    disabled={answered}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left text-[15px] leading-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      answered ? "cursor-default" : "hover:border-[color:var(--accent-edge)] hover:bg-secondary",
                      quiz.selected === i && !answered && "border-primary shadow-[0_0_0_3px_var(--accent-ring)]",
                      isCorrect && "border-mastered bg-mastered-tint",
                      isSelectedWrong && "border-[rgba(168,50,50,0.55)] bg-[rgba(168,50,50,0.055)]",
                      isSelectedForfeit && "border-partial bg-partial-tint",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-px flex h-6 w-6 flex-none items-center justify-center rounded-[7px] border border-border text-[11px] font-bold",
                        isCorrect && "border-mastered bg-mastered text-white",
                        isSelectedWrong && "border-destructive bg-destructive text-white",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1">{pickL(opt, language)}</span>
                    {isCorrect && <Check className="mt-0.5 h-[15px] w-[15px] flex-none text-mastered-ink" />}
                    {isSelectedWrong && <X className="mt-0.5 h-[15px] w-[15px] flex-none text-danger-ink" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              id="quiz-input"
              value={quiz.input}
              onChange={e => setQuiz(cur => ({ ...cur, input: e.target.value }))}
              placeholder={t("quiz.openPlaceholder")}
              aria-label={t("quiz.openPlaceholder")}
              disabled={answered}
              className="mt-5 block min-h-[116px] w-full resize-y rounded-xl border border-border bg-[var(--glass-4)] p-3.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-default disabled:opacity-70"
            />
          )}

          {quiz.hint && (
            <div className="hint-box">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-partial-ink" />
              <span>
                <strong>{t("quiz.hintLabel")}：</strong>
                {pickL(q.hint, language)}
              </span>
            </div>
          )}

          {quiz.grading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("quiz.grading")}
            </div>
          )}

          {answered && answer && (
            <div className={cn("verdict", verdictClass)} role="status" aria-live="polite">
              <div className="verdict-head">
                {verdictIcon}
                {verdictLabel}
              </div>
              {q.type === "open" && (
                <p>
                  <strong>{t("quiz.reference")}：</strong>
                  {pickL(q.reference, language)}
                </p>
              )}
              <p>{pickL(q.why, language)}</p>
              {answer.forfeit && <p>{t("quiz.forfeitNote")}</p>}
              <span className="citation">
                <BookOpen className="h-3 w-3" />
                {pickL(q.source, language)}
              </span>
            </div>
          )}

          {/* q-actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!answered ? (
              <>
                <button type="button" onClick={() => setQuiz(cur => ({ ...cur, hint: !cur.hint }))} className={btnHint}>
                  {t("quiz.hint")}
                </button>
                <button type="button" onClick={forfeitQuiz} className={cn(btnGhost, btnSm)}>
                  {t("quiz.reveal")}
                </button>
                <span className="flex-1" />
                <button type="button" onClick={confirmQuiz} disabled={quiz.grading} className={btnPrimary}>
                  {q.type === "open" ? t("quiz.submit") : t("quiz.confirm")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1" />
                <button type="button" onClick={nextQuiz} className={btnPrimary}>
                  {idx === total - 1 ? t("quiz.finish") : t("quiz.next")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="kbd-hint">
          <Info className="h-3 w-3 flex-none" />
          {t("quiz.keyboardHint")}
        </p>
      </div>

      {/* Exit confirm (prototype askConfirm → confirmDialog) */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-md rounded-xl border border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("quiz.exitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("quiz.exitBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn(btnSecondary, "rounded-[10px] px-3.5 py-2 text-[13px]")}>
              {t("quiz.exitStay")}
            </AlertDialogCancel>
            <AlertDialogAction className={btnPrimary} onClick={exitQuiz}>
              {t("quiz.exitLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

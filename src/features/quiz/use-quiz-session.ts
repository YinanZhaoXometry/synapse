/**
 * Quiz session driver (epic-6 T1): the thin orchestration between the AI seam,
 * the repository, and the pure session machine. Wires generateQuiz (AD-5,
 * node-attributed at generation, AD-6) → createQuizSession (persisted session)
 * → machine transitions → on completion the evidence mutation exactly once
 * with ALL results (the repository's atomic batch: EvidenceRecords +
 * auto-logged MistakeEntries + session completion). Open answers are graded
 * through gradeOpenAnswer in the user's language; the machine only ever sees
 * the GradedAnswer. Abandon persists the terminal `abandoned` status and
 * records NO evidence; hydrate revives an ACTIVE session (T2 resumption) and
 * refuses terminal ones. Headless — no UI, no routes (later tickets own those).
 */
import { useCallback, useRef, useState } from "react";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialRef, QuizMode } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getMaterial,
  getQuizSession,
  listQuestionsBySession,
  questionSourceLocator,
  useAbandonQuizSessionMutation,
  useCreateQuizSessionMutation,
  useRecordEvidenceMutation,
} from "@/data";
import type { Question } from "@/domain/entities";
import {
  abandonRun,
  applyOpenGrading,
  forfeitCurrent,
  hydrateQuizRun,
  quizResults,
  requestHint,
  selectOption,
  startQuizRun,
  submitCurrent,
  typeOpenAnswer,
  type QuizAnswerResult,
  type QuizRunState,
} from "./session-machine";

export type QuizSessionPhase = "idle" | "generating" | "active" | "completed" | "abandoned";

export interface QuizStartInput {
  materials: MaterialRef[];
  nodeIds: string[];
  mode: QuizMode;
  planId?: string | null;
  taskId?: string | null;
}

export function useQuizSession() {
  const { language } = useLanguage();
  const [run, setRun] = useState<QuizRunState | null>(null);
  const [generating, setGenerating] = useState(false);
  // Ref mirror: transitions are synchronous user events; the mirror keeps
  // handlers race-free without side effects inside setState updaters.
  const runRef = useRef<QuizRunState | null>(null);
  // The persisted questions (full shape incl. keywords) — the driver's private
  // grading input; the machine's masked OUTPUTS stay the UI's only window.
  const questionsRef = useRef<Question[]>([]);
  const createSession = useCreateQuizSessionMutation();
  const recordEvidence = useRecordEvidenceMutation();
  const abandonSession = useAbandonQuizSessionMutation();

  const setRunState = useCallback((next: QuizRunState | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  /** Completion lands evidence EXACTLY once: status completed is one-way, so
   * the prev→next running→completed edge fires a single batched mutation. */
  const applyTransition = useCallback(
    (to: (prev: QuizRunState) => QuizRunState): QuizRunState | null => {
      const prev = runRef.current;
      if (!prev) return null;
      const next = to(prev);
      if (next === prev) return prev;
      setRunState(next);
      if (next.status === "completed" && prev.status !== "completed") {
        const results = quizResults(next);
        if (results && next.sessionId) {
          void recordEvidence.mutateAsync({
            sessionId: next.sessionId,
            results: results.map((r) => ({
              questionId: r.questionId,
              outcome: r.outcome,
              userAnswer: r.userAnswer,
              forfeited: r.forfeited,
            })),
          });
        }
      }
      return next;
    },
    [recordEvidence, setRunState],
  );

  /** The in-flight open grading: seam call in the driver (user's language),
   * outcome applied as a machine transition. An abandon during the await is a
   * safe no-op — applyOpenGrading refuses non-grading states. */
  const gradeActive = useCallback(
    async (questionId: string, answer: string) => {
      const question = questionsRef.current.find((q) => q.id === questionId);
      if (!question) return;
      const material = getMaterial(question.sourceMaterialId);
      const section = material?.sections.find((s) => s.id === question.sourceSectionId);
      const graded = await getCompanionService().gradeOpenAnswer({
        keywords: question.keywords ?? [],
        answer,
        sourceText: section?.text ?? "",
        source: questionSourceLocator(question),
        language,
      });
      applyTransition((prev) => applyOpenGrading(prev, graded));
    },
    [applyTransition, language],
  );

  const start = useCallback(
    async (input: QuizStartInput) => {
      setGenerating(true);
      try {
        const generated = await getCompanionService().generateQuiz({
          materials: input.materials,
          nodeIds: input.nodeIds,
          mode: input.mode,
        });
        const { session, questions } = await createSession.mutateAsync({
          planId: input.planId ?? null,
          taskId: input.taskId ?? null,
          mode: input.mode,
          questions: generated,
        });
        questionsRef.current = questions;
        setRunState(startQuizRun({ mode: session.mode, sessionId: session.id, questions }));
      } finally {
        setGenerating(false);
      }
    },
    [createSession, setRunState],
  );

  const select = useCallback(
    (optionIndex: number) => void applyTransition((prev) => selectOption(prev, optionIndex)),
    [applyTransition],
  );

  const typeAnswer = useCallback(
    (text: string) => void applyTransition((prev) => typeOpenAnswer(prev, text)),
    [applyTransition],
  );

  const hint = useCallback(
    () => void applyTransition((prev) => requestHint(prev)),
    [applyTransition],
  );

  const submit = useCallback(() => {
    const prev = runRef.current;
    if (!prev || prev.status !== "running") return;
    const activeId = prev.views[prev.currentIndex]?.id;
    const next = applyTransition(submitCurrent);
    // open → grading wait: drive the seam call (the machine stays masked)
    if (!next || next === prev || !activeId) return;
    const grading = next.views.find((v) => v.id === activeId);
    if (grading && grading.status === "grading") {
      void gradeActive(activeId, grading.draftAnswer);
    }
  }, [applyTransition, gradeActive]);

  const forfeit = useCallback(
    () => void applyTransition(forfeitCurrent),
    [applyTransition],
  );

  /** Terminal exit (spec story 15): machine abandoned + repository status
   * persisted; evidence never lands for an abandoned session. */
  const abandon = useCallback(() => {
    const prev = runRef.current;
    if (!prev) return;
    const next = abandonRun(prev);
    if (next === prev) return;
    setRunState(next);
    if (prev.status === "running" && next.sessionId) {
      void abandonSession.mutateAsync({ sessionId: next.sessionId });
    }
  }, [abandonSession, setRunState]);

  /** T2 resumption: revive an ACTIVE repository session. Terminal sessions
   * (completed/abandoned — not resumable) return false and change nothing. */
  const hydrate = useCallback(
    (sessionId: string): boolean => {
      const session = getQuizSession(sessionId);
      if (!session || session.status !== "active") return false;
      const questions = listQuestionsBySession(sessionId);
      try {
        const next = hydrateQuizRun(session, questions);
        questionsRef.current = questions;
        setRunState(next);
        return true;
      } catch {
        return false;
      }
    },
    [setRunState],
  );

  const phase: QuizSessionPhase = generating
    ? "generating"
    : run === null
      ? "idle"
      : run.status === "running"
        ? "active"
        : run.status;

  return {
    /** "generating" → "active" → "completed" | "abandoned"; "idle" before a start. */
    phase,
    /** The machine state (masked-or-revealed views) — the runner UI's only input. */
    run,
    /** True while an open answer sits in the grading wait ("对照材料评分中"). */
    grading: run?.views.some((v) => v.status === "grading") ?? false,
    /** Non-null exactly when phase === "completed" — ordered per-answer results. */
    results: run ? quizResults(run) : null,
    start,
    select,
    typeAnswer,
    hint,
    submit,
    forfeit,
    abandon,
    hydrate,
  };
}

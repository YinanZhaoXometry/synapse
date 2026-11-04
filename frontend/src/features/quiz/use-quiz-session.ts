/**
 * Quiz session driver (epic-6 T1; Apollo cutover epic P2-8 T1): the thin
 * orchestration between the AI seam, the typed-hooks layer, and the pure
 * session machine. Wires generateQuiz (AD-5, node-attributed at generation,
 * AD-6) → createQuizSession (persisted session, clientUuid-idempotent) →
 * machine transitions → on completion the evidence mutation exactly once with
 * ALL results (the api's atomic batch: EvidenceRecords + auto-logged
 * MistakeEntries + session completion — the refetch sweep moves every
 * server-scored surface). Open answers are graded through gradeOpenAnswer in
 * the user's language; the machine only ever sees the GradedAnswer. Abandon
 * persists the terminal `abandoned` status and records NO evidence; hydrate
 * revives an ACTIVE session (T2 resumption) and refuses terminal ones.
 * Headless — no UI, no routes (later tickets own those).
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialRef, QuizMode } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  mapQuestion,
  newClientUuid,
  useAbandonQuizSessionMutation,
  useCreateQuizSessionMutation,
  useRecordEvidenceMutation,
} from "@/api";
import type { QuizSessionView } from "@/api/views";
import type { Material, Question, ReadingLocator } from "@/domain/entities";
import {
  abandonRun,
  applyOpenGrading,
  forfeitCurrent,
  hydrateQuizRun,
  quizResults,
  releaseGrading,
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

/**
 * The locator a mistake/citation carries, resolved purely from the question's
 * source section id (the cutover's pure replacement for the repository
 * helper): PDF section ids follow the parse convention `page-N` (entities.ts);
 * markdown slugs are everything else. The page-1 fallback is unreachable for
 * adapter-generated questions — a guard for malformed data only, never a
 * fabricated citation for real flows.
 */
export function questionSourceLocator(sourceSectionId: string): ReadingLocator {
  const page = /^page-(\d+)$/.exec(sourceSectionId);
  return page ? { kind: "pdf", page: Number(page[1]) } : { kind: "markdown", sectionId: sourceSectionId };
}

/**
 * T6 (the T4 sweep candidate): per-tab marker naming the session a launcher
 * JUST started — written by QuizLauncher, consumed once by QuizSessionPage. A
 * Plan/Task Home DIALOG launch navigates to the session route with ?session
 * already set, which that mount cannot tell apart from a reload by memory
 * alone — so a deliberate fresh start rendered the honest-reload 「已恢复」
 * note, a small lie this epic's honesty thread cannot keep. sessionStorage
 * survives the SPA navigation but is consumed on read, so a genuine reload of
 * the same session finds no marker and the note keeps its reload-resume-only
 * meaning (the T2 retake precedent: a fresh start is never a resume).
 */
export const QUIZ_FRESH_LAUNCH_KEY = "synapse-quiz-fresh-launch";

export function useQuizSession(options: { materials?: Material[] } = {}) {
  const { language, t } = useLanguage();
  const [run, setRun] = useState<QuizRunState | null>(null);
  const [generating, setGenerating] = useState(false);
  // Ref mirror: transitions are synchronous user events; the mirror keeps
  // handlers race-free without side effects inside setState updaters.
  const runRef = useRef<QuizRunState | null>(null);
  // The persisted questions (full shape incl. keywords) — the driver's private
  // grading input; the machine's masked OUTPUTS stay the UI's only window.
  const questionsRef = useRef<Question[]>([]);
  // Grading grounding: the owner's materials (source section text for open
  // answers) — read-only mirror updated on render.
  const materialsRef = useRef<Material[]>(options.materials ?? []);
  materialsRef.current = options.materials ?? [];
  // T2 (flagged, additive): monotonically increasing generation id. cancelStart
  // bumps it so an in-flight start becomes stale and creates NO session — the
  // launcher's cancellable-until-first-question contract (UX spine).
  const startGenRef = useRef(0);
  const [createSession] = useCreateQuizSessionMutation();
  const [recordEvidenceMutate] = useRecordEvidenceMutation();
  const [abandonSessionMutate] = useAbandonQuizSessionMutation();

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
          void recordEvidenceMutate({
            variables: {
              input: {
                sessionId: next.sessionId,
                results: results.map((r) => ({
                  questionId: r.questionId,
                  outcome: r.outcome,
                  userAnswer: r.userAnswer,
                  forfeited: r.forfeited,
                })),
              },
            },
          }).catch(() => {
            // Quota/write failure: the results screen's evidence pill derives
            // from the live evidence query, so it honestly stays 记录中 — the
            // toast names the failure.
            toast.error(t("quiz.evidenceSaveFailed"));
          });
        }
      }
      return next;
    },
    [recordEvidenceMutate, setRunState, t],
  );

  /** The in-flight open grading: seam call in the driver (user's language),
   * outcome applied as a machine transition. An abandon during the await is a
   * safe no-op — applyOpenGrading refuses non-grading states. */
  const gradeActive = useCallback(
    async (questionId: string, answer: string) => {
      const question = questionsRef.current.find((q) => q && q.id === questionId);
      if (!question) return;
      const material = materialsRef.current.find((m) => m.id === question.sourceMaterialId);
      const section = material?.sections.find((s) => s.id === question.sourceSectionId);
      try {
        const graded = await getCompanionService().gradeOpenAnswer({
          keywords: question.keywords ?? [],
          answer,
          sourceText: section?.text ?? "",
          source: questionSourceLocator(question.sourceSectionId),
          language,
          // T5 additive pass-through: the server grades by questionId (it owns
          // the keywords + the source); the double grades locally and ignores it.
          questionId: question.id,
        });
        applyTransition((prev) => applyOpenGrading(prev, graded));
      } catch {
        // AD-5 seam rejection (the simulated adapter never throws; a Phase-2
        // LLM behind the interface can). Release the question back to answering
        // with the draft intact so the user can resubmit — no dead-end wait.
        toast.error(t("quiz.gradingFailed"));
        applyTransition((prev) => releaseGrading(prev));
      }
    },
    [applyTransition, language, t],
  );

  const start = useCallback(
    async (input: QuizStartInput) => {
      const genId = ++startGenRef.current;
      setGenerating(true);
      try {
        const generated = await getCompanionService().generateQuiz({
          materials: input.materials,
          nodeIds: input.nodeIds,
          mode: input.mode,
          // T5 additive pass-through: the server adapter generates from the
          // plan/task scope (exactly one — AD-6); the double ignores both.
          planId: input.planId,
          taskId: input.taskId,
        });
        // cancelled mid-generation → stale: no session is created, ever
        if (startGenRef.current !== genId) return;
        const payload = await createSession({
          variables: {
            input: {
              // AD-12: the client-supplied uuid is the create's idempotency key.
              clientUuid: newClientUuid(),
              planId: input.planId ?? null,
              taskId: input.taskId ?? null,
              mode: input.mode,
              questions: generated,
            },
          },
        });
        const created = payload.data?.createQuizSession;
        if (!created) throw new Error("createQuizSession returned no payload");
        if (startGenRef.current !== genId) {
          // cancelled inside the persist tick — the session must not surface
          // as an active orphan: mark it abandoned (no evidence) and stop.
          await abandonSessionMutate({ variables: { input: { sessionId: created.session.id } } });
          return;
        }
        questionsRef.current = created.questions.map(mapQuestion);
        setRunState(
          startQuizRun({
            mode: created.session.mode as QuizMode,
            sessionId: created.session.id,
            questions: created.questions.map(mapQuestion),
          }),
        );
      } finally {
        // only the CURRENT generation may clear the flag — a cancelled start
        // leaves it to cancelStart, a newer start leaves it running
        if (startGenRef.current === genId) setGenerating(false);
      }
    },
    [abandonSessionMutate, createSession, setRunState],
  );

  /** T2 (UX spine 「Quiz: generating」): cancel allowed until the first
   * question renders. Stales any in-flight start — at most an abandoned,
   * evidence-less session row can exist, never a live one. */
  const cancelStart = useCallback(() => {
    startGenRef.current += 1;
    setGenerating(false);
  }, []);

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

  /** Terminal exit (spec story 15): machine abandoned + server status
   * persisted; evidence never lands for an abandoned session. */
  const abandon = useCallback(() => {
    const prev = runRef.current;
    if (!prev) return;
    const next = abandonRun(prev);
    if (next === prev) return;
    setRunState(next);
    if (prev.status === "running" && next.sessionId) {
      void abandonSessionMutate({
        variables: { input: { sessionId: next.sessionId } },
      }).catch(() => toast.error(t("quiz.abandonSaveFailed")));
    }
  }, [abandonSessionMutate, setRunState, t]);

  /** T2 resumption: revive an ACTIVE server session (its full query row rides
   * in — questions hydrated in generation order). Terminal sessions
   * (completed/abandoned — not resumable) return false and change nothing. */
  const hydrate = useCallback(
    (session: QuizSessionView): boolean => {
      if (session.status !== "active") return false;
      try {
        const next = hydrateQuizRun(session, session.questions);
        questionsRef.current = session.questions;
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
    cancelStart,
    select,
    typeAnswer,
    hint,
    submit,
    forfeit,
    abandon,
    hydrate,
  };
}

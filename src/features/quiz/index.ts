/**
 * The quiz feature's public surface (epic-6; AD-2, tasks/index.ts precedent):
 * the session state machine is the epic's one new seam — the launcher, runner,
 * and results surfaces consume it (via the useQuizSession driver) and nothing
 * else reaches into the machine's module internals. T2 adds the plan-flow UI:
 * QuizLauncher (Plan Home dialog + the route's inline start) and QuizRunner
 * (question → paced verdict → results), plus the display-shaping selectors the
 * results numbers flow through (AD-6). T4 extracts the shared route shell
 * (QuizSessionPage) so /plan/:id/quiz and /task/:id/quiz are thin
 * context-scoped compositions — twin parity by construction, not copy-paste.
 * T5 re-points /quiz at the same shell with a DERIVED owner context (the
 * demo's material picker picks the material; its owning plan/task owns the
 * session), plus the quizable-material selector the picker shapes with.
 */
export {
  abandonRun,
  activeMaskedView,
  applyOpenGrading,
  forfeitCurrent,
  hydrateQuizRun,
  quizResults,
  requestHint,
  selectOption,
  startQuizRun,
  submitCurrent,
  typeOpenAnswer,
  type MaskedQuestionView,
  type MaskedStatus,
  type QuestionView,
  type QuizAnswerResult,
  type QuizRunState,
  type RevealedQuestionView,
  type RevealedStatus,
} from "./session-machine";
export { useQuizSession, type QuizSessionPhase, type QuizStartInput } from "./use-quiz-session";
export { QuizLauncher } from "./QuizLauncher";
export { QuizRunner } from "./QuizRunner";
export { QuizResults } from "./QuizResults";
export { QuizSessionPage, type QuizSessionContext } from "./quiz-session-page";
export { quizableMaterials } from "./display-shaping";

/**
 * The quiz feature's public surface (epic-6; AD-2, tasks/index.ts precedent):
 * the session state machine is the epic's one new seam — T2's runner,
 * launcher, and results surfaces consume it (via the useQuizSession driver)
 * and nothing else reaches into the machine's module internals. No UI lives
 * here yet (T1 is headless; pages stay reachable from App.tsx directly).
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

/**
 * Quiz session state machine (epic-6 T1, FR-18; AD-5/6; ADR-0001) — the epic's
 * one new seam: a PURE module owning every transition from generated questions
 * to a completed session. Generate (questions in from the AI seam, persisted
 * by createQuizSession with ids + node attribution, AD-6) → answer → submit
 * (choice auto-graded client-side; open enters the grading wait — the AI
 * seam's `gradeOpenAnswer` runs in the driver, the machine receives the
 * GradedAnswer as a transition input) → forfeit (revealed as wrong) →
 * complete. One question at a time; mix mode is one machine run over the
 * interleaved kinds in the order the generator gave.
 *
 * The attempt gate (NFR-8) is structural: pre-reveal questions surface only as
 * `MaskedQuestionView` — a narrowed type with NO correctOptionIndex, no
 * explanation, no keywords, no outcome — built by explicit field-picking
 * (never a spread). The source questions the transitions need at reveal time
 * ride on the state under a module-private symbol key, invisible to string
 * access, Object.keys, JSON.stringify, and destructuring — so no machine
 * OUTPUT carries answer data before submit/grade/forfeit (asserted by type
 * AND by runtime scan in session-machine.test.ts).
 *
 * Outcome values come from MASTERY_CONFIG (ADR-0001: correct 1 / partial 0.5 /
 * forfeit-wrong 0) — no mastery arithmetic lives here. Event-time refusals
 * (transitions invalid for the current state) return the state unchanged: the
 * machine is total, so UI races (e.g. abandon while grading is in flight)
 * can never corrupt honesty. Only construction-time misuse throws AppError.
 */
import type { GradedAnswer, QuizMode } from "@/ai/types";
import type { Outcome, Question, QuizSession } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { AppError } from "@/data";

/**
 * Module-private key carrying the persisted source questions on the run state
 * (reveal-time facts: correctOptionIndex, explanation, keywords). Never
 * exported — machine consumers cannot reach it through the type system, and
 * enumerable-symbol semantics keep it out of every string-keyed view of the
 * state.
 */
const SOURCES = Symbol("quizRunSources");

// -- views ---------------------------------------------------------------------

/** Pre-reveal per-question statuses (the attempt gate holds through all of them). */
export type MaskedStatus = "pending" | "answering" | "grading";

/**
 * The narrowed answering-side view: what the runner UI may see before the
 * verdict. Deliberately lacks correctOptionIndex / explanation / keywords /
 * outcome / grading — leaking is impossible by type (and by construction).
 */
export interface MaskedQuestionView {
  id: string;
  /** Node attribution from the generator (AD-6), carried untouched. */
  nodeId: string;
  kind: "open" | "choice";
  prompt: string;
  /** Choice only (single-select, Phase 1 — spec decision 2); [] for open. */
  options: string[];
  sourceMaterialId: string;
  sourceSectionId: string;
  status: MaskedStatus;
  /** Outcome-neutral hint flag (hint CONTENT is a later ticket's concern). */
  hintUsed: boolean;
  /** Choice, while answering: the selected option index (unconfirmed taps allowed). */
  selectedOptionIndex: number | null;
  /** Open, while answering: the drafted text; frozen at submit (grading wait). */
  draftAnswer: string;
}

/** Post-reveal statuses: submit/grade/forfeit has happened — the gate is open. */
export type RevealedStatus = "submitted" | "graded" | "forfeited";

/**
 * The revealed view: answer + rationale + citation now visible (FR-18 review).
 * A forfeit reveals the correct answer + explanation too — 「看答案」 is honest.
 */
export interface RevealedQuestionView {
  id: string;
  nodeId: string;
  kind: "open" | "choice";
  prompt: string;
  options: string[];
  /** Choice only; null for open. */
  correctOptionIndex: number | null;
  sourceMaterialId: string;
  sourceSectionId: string;
  /** The generator's explanation — the choice/forfeit rationale for the UI. */
  explanation: string;
  keywords: string[];
  status: RevealedStatus;
  /** A forfeit grades as "wrong" (ADR-0001 / GLOSSARY: Outcome). */
  outcome: Outcome;
  /** ADR-0001 value via MASTERY_CONFIG: correct 1 / partial 0.5 / wrong 0. */
  outcomeValue: number;
  userAnswer: string;
  forfeited: boolean;
  hintUsed: boolean;
  /** Open graded only — the AI seam's rationale + source citation carried through. */
  grading: GradedAnswer | null;
}

export type QuestionView = MaskedQuestionView | RevealedQuestionView;

export interface QuizRunState {
  sessionId: string | null;
  mode: QuizMode;
  status: "running" | "completed" | "abandoned";
  /** The active question's index while running; -1 once terminal. */
  currentIndex: number;
  /** All questions in generator order; masked until individually revealed. */
  views: QuestionView[];
  /** Module-private; see SOURCES. Symbol-keyed — string access never sees it. */
  [SOURCES]?: Question[];
}

/** The ordered per-answer result of a COMPLETED run (the results UI's input). */
export interface QuizAnswerResult {
  questionId: string;
  nodeId: string;
  kind: "open" | "choice";
  prompt: string;
  outcome: Outcome;
  outcomeValue: number;
  userAnswer: string;
  forfeited: boolean;
  hintUsed: boolean;
  sourceMaterialId: string;
  sourceSectionId: string;
  correctOptionIndex: number | null;
  explanation: string;
  grading: GradedAnswer | null;
}

// -- construction ----------------------------------------------------------------

function maskedView(question: Question, status: MaskedStatus): MaskedQuestionView {
  // Field-picking, NOT a spread: the masked object must not carry the answer
  // data under any key (runtime gate assertion scans keys + JSON).
  return {
    id: question.id,
    nodeId: question.nodeId,
    kind: question.kind,
    prompt: question.prompt,
    options: question.kind === "choice" ? (question.options ?? []) : [],
    sourceMaterialId: question.sourceMaterialId,
    sourceSectionId: question.sourceSectionId,
    status,
    hintUsed: false,
    selectedOptionIndex: null,
    draftAnswer: "",
  };
}

function revealedView(masked: MaskedQuestionView, source: Question, reveal: {
  status: RevealedStatus;
  outcome: Outcome;
  userAnswer: string;
  forfeited: boolean;
  grading: GradedAnswer | null;
}): RevealedQuestionView {
  return {
    id: masked.id,
    nodeId: masked.nodeId,
    kind: masked.kind,
    prompt: masked.prompt,
    options: masked.options,
    correctOptionIndex: source.kind === "choice" ? (source.correctOptionIndex ?? null) : null,
    sourceMaterialId: masked.sourceMaterialId,
    sourceSectionId: masked.sourceSectionId,
    explanation: source.explanation,
    keywords: source.keywords ?? [],
    status: reveal.status,
    outcome: reveal.outcome,
    outcomeValue: MASTERY_CONFIG.outcomeValues[reveal.outcome],
    userAnswer: reveal.userAnswer,
    forfeited: reveal.forfeited,
    hintUsed: masked.hintUsed,
    grading: reveal.grading,
  };
}

/**
 * Start a run over the session's persisted questions (the AI seam's
 * GeneratedQuestion shape after createQuizSession assigned ids — AD-6).
 * Question 1 is answering; the rest stay pending behind the gate.
 */
export function startQuizRun(input: {
  mode: QuizMode;
  sessionId: string | null;
  questions: Question[];
}): QuizRunState {
  if (input.questions.length === 0) {
    throw new AppError("QUIZ_RUN_EMPTY");
  }
  const views = input.questions.map((q, i) => maskedView(q, i === 0 ? "answering" : "pending"));
  return {
    sessionId: input.sessionId,
    mode: input.mode,
    status: "running",
    currentIndex: 0,
    views,
    [SOURCES]: input.questions,
  };
}

/**
 * Hydrate an ACTIVE session from the repository (T2 resumption, spec decision
 * 7). Terminal sessions are refused — abandoned/completed runs are NOT
 * resumable. Progress between answers is not persisted (evidence lands once,
 * at completion), so the run resumes honestly at question 1.
 */
export function hydrateQuizRun(session: QuizSession, questions: Question[]): QuizRunState {
  if (session.status !== "active") {
    throw new AppError("QUIZ_RUN_NOT_RESUMABLE");
  }
  const idsMatch =
    questions.length === session.questionIds.length &&
    questions.every((q, i) => q.id === session.questionIds[i] && q.sessionId === session.id);
  if (!idsMatch) {
    throw new AppError("QUIZ_RUN_QUESTIONS_MISMATCH");
  }
  return startQuizRun({ mode: session.mode, sessionId: session.id, questions });
}

// -- internals -------------------------------------------------------------------

function isMasked(view: QuestionView): view is MaskedQuestionView {
  return view.status === "pending" || view.status === "answering" || view.status === "grading";
}

function sourceOf(state: QuizRunState, questionId: string): Question | undefined {
  return (state[SOURCES] ?? []).find((q) => q.id === questionId);
}

/** The one question the user is on (answering or grading); null when terminal. */
export function activeMaskedView(state: QuizRunState): MaskedQuestionView | null {
  if (state.status !== "running") return null;
  const view = state.views[state.currentIndex];
  return view && isMasked(view) && view.status !== "pending" ? view : null;
}

/** All done? → completed (terminal). Otherwise the next pending becomes active. */
function advance(state: QuizRunState): QuizRunState {
  const nextIndex = state.views.findIndex((v) => isMasked(v) && v.status === "pending");
  if (nextIndex === -1) {
    return { ...state, status: "completed", currentIndex: -1 };
  }
  const views = state.views.map((v, i) =>
    i === nextIndex && isMasked(v) ? { ...v, status: "answering" as const } : v,
  );
  return { ...state, views, currentIndex: nextIndex };
}

function reveal(state: QuizRunState, source: Question, reveal: {
  status: RevealedStatus;
  outcome: Outcome;
  userAnswer: string;
  forfeited: boolean;
  grading: GradedAnswer | null;
}): QuizRunState {
  const views = state.views.map((v) =>
    v.id === source.id && isMasked(v) ? revealedView(v, source, reveal) : v,
  );
  return advance({ ...state, views });
}

// -- transitions (pure; refusals return the SAME state) ---------------------------

/** Choice: park a selection (0-based). Confirmed later by submitCurrent. */
export function selectOption(state: QuizRunState, optionIndex: number): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.kind !== "choice" || active.status !== "answering") return state;
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= active.options.length) {
    return state;
  }
  const views = state.views.map((v) =>
    v.id === active.id && isMasked(v) ? { ...v, selectedOptionIndex: optionIndex } : v,
  );
  return { ...state, views };
}

/** Open: record the drafted answer text. */
export function typeOpenAnswer(state: QuizRunState, text: string): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.kind !== "open" || active.status !== "answering") return state;
  const views = state.views.map((v) =>
    v.id === active.id && isMasked(v) ? { ...v, draftAnswer: text } : v,
  );
  return { ...state, views };
}

/** Outcome-neutral hint request: flips the flag, reveals nothing. */
export function requestHint(state: QuizRunState): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.status !== "answering") return state;
  const views = state.views.map((v) =>
    v.id === active.id && isMasked(v) ? { ...v, hintUsed: true } : v,
  );
  return { ...state, views };
}

/**
 * Confirm the active answer. Choice: auto-grade client-side (outcome 1 or 0)
 * and reveal. Open: enter the grading wait — NO outcome, still masked; the
 * driver grades through the AI seam and applies it with applyOpenGrading.
 * A choice question without a selection refuses (accidental taps never count,
 * spec story 10).
 */
export function submitCurrent(state: QuizRunState): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.status !== "answering") return state;
  const source = sourceOf(state, active.id);
  if (!source) return state;
  if (active.kind === "choice") {
    if (active.selectedOptionIndex === null) return state;
    const correct = active.selectedOptionIndex === source.correctOptionIndex;
    return reveal(state, source, {
      status: "submitted",
      outcome: correct ? "correct" : "wrong",
      userAnswer: active.options[active.selectedOptionIndex],
      forfeited: false,
      grading: null,
    });
  }
  // open → grading wait: masked, no outcome, draft frozen
  const views = state.views.map((v) =>
    v.id === active.id && isMasked(v) ? { ...v, status: "grading" as const } : v,
  );
  return { ...state, views };
}

/**
 * The driver's AI-seam grading result lands here: outcome + rationale + source
 * citation are carried onto the revealed view for the UI (FR-18 grade
 * rationale shown). Refuses unless the active question is the open one in the
 * grading wait (an abandon during the await is a safe no-op).
 */
export function applyOpenGrading(state: QuizRunState, graded: GradedAnswer): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.kind !== "open" || active.status !== "grading") return state;
  const source = sourceOf(state, active.id);
  if (!source) return state;
  return reveal(state, source, {
    status: "graded",
    outcome: graded.outcome,
    userAnswer: active.draftAnswer,
    forfeited: false,
    grading: { outcome: graded.outcome, rationale: graded.rationale, citation: graded.citation },
  });
}

/**
 * 「看答案」 — forfeit before submit: revealed as wrong, outcome 0 (ADR-0001),
 * correct answer + rationale now visible. Refused once submitted (grading
 * wait included) — forfeit is a pre-submit exit only.
 */
export function forfeitCurrent(state: QuizRunState): QuizRunState {
  const active = activeMaskedView(state);
  if (!active || active.status !== "answering") return state;
  const source = sourceOf(state, active.id);
  if (!source) return state;
  return reveal(state, source, {
    status: "forfeited",
    outcome: "wrong",
    userAnswer: active.kind === "choice" && active.selectedOptionIndex !== null
      ? active.options[active.selectedOptionIndex]
      : active.draftAnswer,
    forfeited: true,
    grading: null,
  });
}

/**
 * Exit path (spec story 15): terminal `abandoned`. Not resumable (see
 * hydrateQuizRun); already-revealed views stay revealed, nothing more
 * transitions. The driver persists the repository status — no evidence.
 */
export function abandonRun(state: QuizRunState): QuizRunState {
  if (state.status !== "running") return state;
  return { ...state, status: "abandoned", currentIndex: -1 };
}

/**
 * The ordered per-answer results of a COMPLETED run — null until then (an
 * abandoned run produces nothing; evidence never lands for it). Order is the
 * generator's (mix interleaves as given).
 */
export function quizResults(state: QuizRunState): QuizAnswerResult[] | null {
  if (state.status !== "completed") return null;
  return state.views.map((v) => {
    const revealed = v as RevealedQuestionView;
    return {
      questionId: revealed.id,
      nodeId: revealed.nodeId,
      kind: revealed.kind,
      prompt: revealed.prompt,
      outcome: revealed.outcome,
      outcomeValue: revealed.outcomeValue,
      userAnswer: revealed.userAnswer,
      forfeited: revealed.forfeited,
      hintUsed: revealed.hintUsed,
      sourceMaterialId: revealed.sourceMaterialId,
      sourceSectionId: revealed.sourceSectionId,
      correctOptionIndex: revealed.correctOptionIndex,
      explanation: revealed.explanation,
      grading: revealed.grading,
    };
  });
}

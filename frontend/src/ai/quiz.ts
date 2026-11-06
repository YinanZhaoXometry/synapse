/**
 * The companion quiz-block contract (epic-24 T4): 考考我 replies end in ONE
 * fenced ```synapse-quiz JSON block riding the reply TEXT. Design law (the
 * epic spec, D4): the SSE wire stays byte-frozen — no terminal/rung/schema
 * change — because the fence lives inside the streamed text, and thread
 * persistence (ChatMessage.text) carries it verbatim, so a restored thread
 * RE-PARSES the fence and the interactive block rehydrates. Both the
 * simulated double and the GLM prompts (companion + plan_companion) speak
 * this exact format; a malformed fence degrades honestly to the plain-text
 * bubble (never a fake block, never a crash).
 *
 * NFR-8 boundary: nothing in the payload is rendered before an attempt — the
 * answer/explanation fields are the QuizBlock's post-submit reveal only.
 */
export const QUIZ_FENCE_MARKER = "```synapse-quiz";

export interface CompanionQuiz {
  /** choice = selectable options; short = free-text (keyword-graded). */
  kind: "choice" | "short";
  question: string;
  /** choice only: 2–6 non-empty options. */
  options?: string[];
  /** choice only: the 0-based index of the correct option. */
  answer?: number;
  /** short only: the reference answer shown after submit. */
  answerText?: string;
  /** short only: 2–3 key terms a good answer uses (the grading lens). */
  keywords?: string[];
  /** The teaching note revealed with the verdict. */
  explanation?: string;
}

export interface QuizSplit {
  /** The reply text before the fence (the lead-in line), trimmed. */
  lead: string;
  /** The parsed block — null when absent/malformed (the raw text renders). */
  quiz: CompanionQuiz | null;
}

/** Structural validation — the fence parses only into a USABLE question. */
export function isValidCompanionQuiz(value: unknown): value is CompanionQuiz {
  const quiz = value as CompanionQuiz | null;
  if (!quiz || typeof quiz !== "object") return false;
  if (typeof quiz.question !== "string" || quiz.question.trim().length === 0) return false;
  if (quiz.kind === "choice") {
    return (
      Array.isArray(quiz.options) &&
      quiz.options.length >= 2 &&
      quiz.options.length <= 6 &&
      quiz.options.every((option) => typeof option === "string" && option.trim().length > 0) &&
      typeof quiz.answer === "number" &&
      Number.isInteger(quiz.answer) &&
      quiz.answer >= 0 &&
      quiz.answer < quiz.options.length
    );
  }
  if (quiz.kind === "short") {
    return typeof quiz.answerText === "string" && quiz.answerText.trim().length > 0;
  }
  return false;
}

/**
 * Split a reply text into its lead + the quiz block. Full-fence-or-nothing:
 * an unterminated or malformed fence is NOT a block — the whole original
 * text renders (honest degradation; the lead alone would hide what the
 * model actually said).
 */
export function splitQuizBlock(text: string): QuizSplit {
  const markerAt = text.indexOf(QUIZ_FENCE_MARKER);
  if (markerAt < 0) return { lead: text, quiz: null };
  const rest = text.slice(markerAt + QUIZ_FENCE_MARKER.length);
  const closeAt = rest.indexOf("```");
  if (closeAt < 0) return { lead: text, quiz: null };
  try {
    const parsed: unknown = JSON.parse(rest.slice(0, closeAt).trim());
    if (isValidCompanionQuiz(parsed)) {
      return { lead: text.slice(0, markerAt).trim(), quiz: parsed };
    }
  } catch {
    // malformed JSON — fall through to the raw render
  }
  return { lead: text, quiz: null };
}

/**
 * The streaming slice: everything before the fence marker (mid-stream the
 * JSON must never flash into the bubble). A partially-arrived marker prefix
 * (e.g. trailing "``") may briefly show — harmless, honest.
 */
export function leadBeforeQuiz(text: string): string {
  const markerAt = text.indexOf(QUIZ_FENCE_MARKER);
  return markerAt < 0 ? text : text.slice(0, markerAt).trim();
}

/** Format a quiz as the canonical fence (the simulated double's emitter). */
export function formatQuizFence(quiz: CompanionQuiz): string {
  return `${QUIZ_FENCE_MARKER}\n${JSON.stringify(quiz)}\n\`\`\``;
}

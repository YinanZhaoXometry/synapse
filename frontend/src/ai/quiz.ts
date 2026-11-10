/**
 * The companion quiz-block contract (epic-24 T4): 考考我 replies end in ONE
 * fenced ```synapse-quiz JSON block riding the reply TEXT. Design law (the
 * epic spec, D4): the SSE wire stays byte-frozen — no terminal/rung/schema
 * change — because the fence lives inside the streamed text, and thread
 * persistence (ChatMessage.text) carries it verbatim, so a restored thread
 * RE-PARSES the fence and the interactive block rehydrates. Both the
 * simulated double and the GLM prompts (companion + plan_companion) speak
 * this exact format; a malformed payload degrades honestly to the plain-text
 * bubble (never a fake block, never a crash). Live-model drift — the payload
 * arriving bare (no/unclosed fence) — is salvaged back into the block
 * (owner bug round 2026-11-10); only a truly unusable payload stays prose.
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
 * Split a reply text into its lead + the quiz block. Full-fence-or-nothing
 * for the fence itself — but when the fence is absent the bare-JSON salvage
 * still runs (live models occasionally drop the fence and emit the payload
 * as a raw JSON object riding the reply tail; owner bug round 2026-11-10).
 * A malformed payload renders the whole original text (honest degradation;
 * the lead alone would hide what the model actually said).
 */
export function splitQuizBlock(text: string): QuizSplit {
  const markerAt = text.indexOf(QUIZ_FENCE_MARKER);
  if (markerAt >= 0) {
    const rest = text.slice(markerAt + QUIZ_FENCE_MARKER.length);
    const closeAt = rest.indexOf("```");
    if (closeAt >= 0) {
      try {
        const parsed: unknown = JSON.parse(rest.slice(0, closeAt).trim());
        if (isValidCompanionQuiz(parsed)) {
          return { lead: text.slice(0, markerAt).trim(), quiz: parsed };
        }
      } catch {
        // malformed fenced JSON — fall through to the bare salvage
      }
    }
  }
  const salvaged = salvageBareQuiz(text);
  return salvaged ?? { lead: text, quiz: null };
}

/**
 * Bare-JSON drift marker (owner bug round 2026-11-10): the payload arrives
 * with no synapse-quiz fence at all, or an opened-but-never-closed one.
 * Tolerates spacing drift around the colon — the exact key order the prompt
 * shows is what the model still emits, just undecoated.
 */
const BARE_QUIZ_TAIL_RE = /\{\s*"kind"\s*:\s*"(?:choice|short)"/g;

/** Every bare-payload start index, in order (empty when none). */
function bareQuizStarts(text: string): number[] {
  BARE_QUIZ_TAIL_RE.lastIndex = 0;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = BARE_QUIZ_TAIL_RE.exec(text)) !== null) starts.push(match.index);
  return starts;
}

/**
 * The payload object's balanced end (string/escape aware) from `start` —
 * -1 when the object never closes (mid-stream snapshot; not salvageable yet).
 */
function balancedObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** A drift-wrapped payload may still carry plain-fence remnants around it. */
const FENCE_REMNANT_TAIL_RE = /\s*```[a-z-]*\s*$/;
const FENCE_REMNANT_HEAD_RE = /^\s*```[a-z-]*\s*/;

/**
 * The salvage path: scan bare-payload candidates last-to-first (the payload
 * rides the reply tail; later prose quoting the shape must not win), parse
 * each balanced object, validate — the first USABLE one becomes the block.
 * Words after the payload (beyond a closing-fence remnant) rejoin the lead —
 * never hidden. Null when nothing validates: the raw text renders.
 */
function salvageBareQuiz(text: string): QuizSplit | null {
  const starts = bareQuizStarts(text);
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i];
    const end = balancedObjectEnd(text, start);
    if (end < 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      continue;
    }
    if (!isValidCompanionQuiz(parsed)) continue;
    let lead = text
      .slice(0, start)
      .replace(FENCE_REMNANT_TAIL_RE, "")
      .trim();
    const after = text
      .slice(end + 1)
      .replace(FENCE_REMNANT_HEAD_RE, "")
      .trim();
    if (after.length > 0) lead = `${lead}\n\n${after}`.trim();
    return { lead, quiz: parsed };
  }
  return null;
}

/**
 * The streaming slice: everything before the quiz tail starts (fence marker
 * or bare payload — mid-stream the JSON must never flash into the bubble).
 * A partially-arrived marker prefix (e.g. trailing "``") may briefly show —
 * harmless, honest.
 */
export function leadBeforeQuiz(text: string): string {
  const markerAt = text.indexOf(QUIZ_FENCE_MARKER);
  if (markerAt >= 0) return text.slice(0, markerAt).trim();
  const starts = bareQuizStarts(text);
  return starts.length > 0 ? text.slice(0, starts[0]).trim() : text;
}

/**
 * Whether the quiz tail has started arriving — the streaming bubble's
 * honest 出题中 signal (fence marker OR bare drift payload).
 */
export function quizTailArrived(text: string): boolean {
  if (text.includes(QUIZ_FENCE_MARKER)) return true;
  return bareQuizStarts(text).length > 0;
}

/** Format a quiz as the canonical fence (the simulated double's emitter). */
export function formatQuizFence(quiz: CompanionQuiz): string {
  return `${QUIZ_FENCE_MARKER}\n${JSON.stringify(quiz)}\n\`\`\``;
}

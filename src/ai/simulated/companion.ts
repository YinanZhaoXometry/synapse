/**
 * Deterministic simulated Companion (AD-5): keyword-routed intent, hint-first
 * ladder, honest beyond-material fallback, streamed emission. Same input →
 * same output — tests are stable, the Nov 6 demo repeats. No randomness, no
 * provider calls; the server adapter (FR-33) replaces this class.
 */
import type {
  CompanionIntent,
  CompanionReply,
  GeneratedQuestion,
  GradedAnswer,
  GroundedChatRequest,
  GuardrailRung,
  MaterialRef,
  PlanStructureProposal,
  ProposedStage,
  QuizMode,
  UiLanguage,
} from "@/ai/types";
import type { CompanionService } from "@/ai/companion-service";
import type { ReadingLocator } from "@/domain/entities";
import { planTemplateFor } from "./templates";
import {
  generateFlashcardsFromMaterials,
  generateQuizFromMaterials,
  gradeOpenAnswerFromKeywords,
} from "./generation";

/** Artificial delay (ms) — the "thinking" beat the UI's typing dots render. */
const CHAT_DELAY = 600;
const STREAM_STEP_DELAY = 30;

const COPY = {
  zh: {
    hint: (quote: string) => `先往这个方向想：这一页谈到「${quote}」。它为什么成立？再试试？`,
    answer: (quote: string) => `答案：${quote}（来自你正在读的一页）`,
    reference: (quote: string) => `${quote}——这一页给了定义，注意它的前提条件。`,
    quizMe: (quote: string) => `好，考你一个：${quote}——你会怎么向别人解释这句话？先说说看。`,
    beyond: "这一页答不了这个问题。我可以基于通用知识回答，但会明确标注不是来自你的材料。",
  },
  en: {
    hint: (quote: string) => `Try this direction first: this page says "${quote}". Why would that hold? Give it another shot.`,
    answer: (quote: string) => `Answer: ${quote} (from the page you're on)`,
    reference: (quote: string) => `${quote} — the page defines it; watch its preconditions.`,
    quizMe: (quote: string) => `Let's test you: "${quote}" — how would you explain this line to someone else? Go ahead.`,
    beyond: "This page can't answer that. I can answer from general knowledge — clearly labeled as outside your material.",
  },
} as const;

/** Direct-answer requests get honored (escalation always reachable). */
const DIRECT = /直接|答案|直接告诉我|tell me|direct|the answer/i;
const EXPLAIN = /为什么|为何|怎么会|why|how come|explain/i;
const QUIZ_ME = /考(一)?考|考考|quiz|test me/i;

/**
 * Comparable terms: latin words + CJK 2-char shingles (whole CJK runs never
 * appear verbatim in material text — shingles make zh↔zh matching work).
 */
function terms(text: string): string[] {
  const latin = (text.match(/[a-zA-Z]{3,}/g) ?? []).map((w) => w.toLowerCase());
  const shingles: string[] = [];
  for (const run of text.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    for (let i = 0; i <= run.length - 2; i++) shingles.push(run.slice(i, i + 2));
  }
  return [...shingles, ...latin];
}

/** The supporting sentence in the position text, or null if nothing matches. */
function matchSentence(question: string, positionText: string): string | null {
  const sentences = positionText.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [];
  const qTerms = terms(question);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (qTerms.some((t) => lower.includes(t.toLowerCase()))) {
      return sentence.trim();
    }
  }
  return null;
}

function firstSentence(positionText: string): string {
  return (positionText.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [positionText])[0].trim();
}

function emit(text: string, onToken?: (chunk: string) => void): Promise<void> {
  if (!onToken) return Promise.resolve();
  // Deterministic slicing — no randomness anywhere in the simulated adapter.
  const size = 8;
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      if (i >= text.length) return resolve();
      onToken(text.slice(i, i + size));
      i += size;
      setTimeout(step, STREAM_STEP_DELAY);
    };
    step();
  });
}

export class SimulatedCompanion implements CompanionService {
  async chat(
    request: GroundedChatRequest,
    onToken?: (chunk: string) => void,
  ): Promise<CompanionReply> {
    const { question, position, language } = request;
    const copy = COPY[language];

    let quote = matchSentence(question, position.text);
    let intent: CompanionIntent;
    let rung: GuardrailRung;
    let text: string;

    if (QUIZ_ME.test(question)) {
      // Quiz-me is inherently grounded on the open page (NFR-8) — cite it even
      // when no keyword overlap exists.
      intent = "quiz-me";
      rung = "hint";
      quote ??= firstSentence(position.text);
      text = copy.quizMe(quote);
    } else if (!quote) {
      intent = "beyond-material";
      rung = "answer";
      text = copy.beyond;
    } else if (DIRECT.test(question)) {
      intent = "direct";
      rung = "answer";
      text = copy.answer(quote);
    } else if (EXPLAIN.test(question)) {
      intent = "explain";
      rung = "hint";
      text = copy.hint(quote);
    } else {
      intent = "reference";
      rung = "answer";
      text = copy.reference(quote);
    }

    await new Promise((r) => setTimeout(r, CHAT_DELAY));
    await emit(text, onToken);

    return {
      intent,
      rung,
      text,
      citations: quote ? [{ locator: position.locator, quote }] : [],
      canEscalate: intent !== "beyond-material",
      language,
    };
  }

  async generatePlanStructure(
    topic: string,
    language: UiLanguage,
    onToken?: (chunk: string) => void,
  ): Promise<PlanStructureProposal> {
    const template = planTemplateFor(topic, language);
    const proposal: PlanStructureProposal = {
      topic,
      stages: template.stages as ProposedStage[],
      language,
    };

    // Streamed like chat: intro line, then one line per node.
    const lines = [
      template.intro,
      ...proposal.stages.flatMap((s) => [`## ${s.name}`, ...s.nodeTitles.map((t) => `- ${t}`)]),
    ].join("\n");
    await emit(lines, onToken);
    return proposal;
  }

  async generateQuiz(input: {
    materials: MaterialRef[];
    nodeIds: string[];
    mode: QuizMode;
  }): Promise<GeneratedQuestion[]> {
    // A "generating" beat so the UI's waiting state renders (Quiz: generating, EXPERIENCE.md).
    await new Promise((r) => setTimeout(r, CHAT_DELAY));
    return generateQuizFromMaterials(input);
  }

  async generateFlashcards(input: {
    materials: MaterialRef[];
  }): Promise<Array<{ front: string; back: string }>> {
    await new Promise((r) => setTimeout(r, CHAT_DELAY));
    return generateFlashcardsFromMaterials(input);
  }

  async gradeOpenAnswer(input: {
    keywords: string[];
    answer: string;
    sourceText: string;
    source: ReadingLocator;
    language: UiLanguage;
  }): Promise<GradedAnswer> {
    // Grading wait: shimmer + 「对照材料评分中」 (EXPERIENCE.md quiz grading state).
    await new Promise((r) => setTimeout(r, CHAT_DELAY));
    return gradeOpenAnswerFromKeywords(input);
  }
}

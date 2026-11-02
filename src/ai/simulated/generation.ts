/**
 * Simulated generation + grading (spec Q5 decision): questions are template-
 * extracted from the materials' actual parsed sections — headings become
 * choice prompts, section sentences become open prompts with keywords.
 * Deterministic per input; node attribution round-robins (AD-6). Nothing is
 * generated from outside the provided sections (FR-18/NFR-1 sourcing).
 */
import type { MaterialRef, GeneratedQuestion, GradedAnswer, QuizMode, UiLanguage } from "@/ai/types";
import type { ReadingLocator } from "@/domain/entities";

const MAX_QUESTIONS = 8;

function firstSentence(text: string): string {
  return (text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [text])[0].trim();
}

/** Choice question from a heading; distractors are other sections' titles (still materials-sourced). */
function choiceFromSection(section: MaterialRef["sections"][number], all: MaterialRef["sections"], materialId: string, nodeId: string, index: number): GeneratedQuestion {
  const others = all.filter((s) => s.id !== section.id).map((s) => s.title);
  const options = [section.title, ...others.slice(0, 2)];
  // deterministic rotation of the correct option (0..2) so the answer position varies
  const correctOptionIndex = index % options.length;
  if (correctOptionIndex !== 0) {
    [options[0], options[correctOptionIndex]] = [options[correctOptionIndex], options[0]];
  }
  return {
    prompt: `Which topic does「${section.title}」belong to? / 「${section.title}」讲的是哪个主题？`,
    nodeId,
    kind: "choice",
    options,
    correctOptionIndex,
    sourceMaterialId: materialId,
    sourceSectionId: section.id,
    explanation: `${section.title} — ${firstSentence(section.text)}`,
  };
}

/** Open question from a section: first sentence prompt, keywords from the section text. */
function openFromSection(section: MaterialRef["sections"][number], materialId: string, nodeId: string): GeneratedQuestion {
  const sentence = firstSentence(section.text);
  return {
    prompt: `请解释「${section.title}」：${sentence} — 你怎么理解这句话？`,
    nodeId,
    kind: "open",
    sourceMaterialId: materialId,
    sourceSectionId: section.id,
    keywords: keywordTerms(section),
    explanation: sentence,
  };
}

/** Keyword terms for grading: section title (verbatim) + CJK bigrams from title+first sentence. */
function keywordTerms(section: MaterialRef["sections"][number]): string[] {
  const sentence = firstSentence(section.text);
  const bigrams: string[] = [];
  for (const run of (section.title + sentence).match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    bigrams.push(run.slice(0, 2));
  }
  return [...new Set([section.title, ...bigrams])].filter((k) => k.length >= 2).slice(0, 4);
}

export function generateQuizFromMaterials(input: {
  materials: MaterialRef[];
  nodeIds: string[];
  mode: QuizMode;
}): GeneratedQuestion[] {
  const candidates: GeneratedQuestion[] = [];
  let nodeCursor = 0;

  for (const material of input.materials) {
    material.sections.forEach((section, i) => {
      const nodeId = input.nodeIds[nodeCursor++ % input.nodeIds.length];
      candidates.push(choiceFromSection(section, material.sections, material.materialId, nodeId, i));
      const openNodeId = input.nodeIds[nodeCursor++ % input.nodeIds.length];
      candidates.push(openFromSection(section, material.materialId, openNodeId));
    });
  }

  let picked = candidates;
  if (input.mode === "choice") picked = candidates.filter((q) => q.kind === "choice");
  if (input.mode === "open") picked = candidates.filter((q) => q.kind === "open");
  return picked.slice(0, MAX_QUESTIONS);
}

export function generateFlashcardsFromMaterials(input: {
  materials: MaterialRef[];
}): Array<{ front: string; back: string }> {
  const cards: Array<{ front: string; back: string }> = [];
  for (const material of input.materials) {
    for (const section of material.sections) {
      cards.push({ front: `${section.title} — 要点是什么？`, back: firstSentence(section.text) });
    }
  }
  return cards;
}

/** Grading rule (spec): ≥2 keyword hits correct, 1 partial, 0 wrong; rationale cites the matched sentence. */
export function gradeOpenAnswerFromKeywords(input: {
  keywords: string[];
  answer: string;
  sourceText: string;
  source: ReadingLocator;
  language: UiLanguage;
}): GradedAnswer {
  const hits = input.keywords.filter((k) => input.answer.includes(k));
  const outcome = hits.length >= 2 ? "correct" : hits.length === 1 ? "partial" : "wrong";

  const matchedSentence =
    (input.sourceText.match(/[^.!?。！？]+[.!?。！？]?/g) ?? []).find((s) =>
      input.keywords.some((k) => s.includes(k)),
    )?.trim() ?? null;

  const rationale =
    input.language === "en"
      ? outcome === "correct"
        ? `Graded against your material · hit key points: ${hits.join(", ")}.`
        : outcome === "partial"
          ? `Graded against your material · only "${hits[0]}" hit — other key points are missing.`
          : "Graded against your material · no key points hit — re-read this section."
      : outcome === "correct"
        ? `对照材料评分 · 命中要点：${hits.join("、")}。`
        : outcome === "partial"
          ? `对照材料评分 · 只命中「${hits[0]}」——还差其他要点。`
          : "对照材料评分 · 没有命中材料中的要点，回去再读一读这一节。";

  return {
    outcome,
    rationale,
    citation: matchedSentence ? { locator: input.source, quote: matchedSentence } : null,
  };
}

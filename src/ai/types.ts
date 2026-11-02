/**
 * AI seam types (AD-5): the structured response contract the UI renders —
 * intent, guardrail rung, citations. Features never guess the posture.
 */
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";

export type UiLanguage = "zh" | "en";

export type CompanionIntent =
  | "explain" // scaffolded explanation, hint-first
  | "direct" // explicit answer request — escalation honored
  | "quiz-me" // Socratic; never reveals before an attempt (NFR-8)
  | "reference" // define/compare/list — low guardrail friction
  | "beyond-material"; // honest fallback (NFR-1)

/** Ladder position of THIS message: hint → worked-step → answer. */
export type GuardrailRung = "hint" | "worked-step" | "answer";

export interface Citation {
  locator: ReadingLocator;
  /** The exact supporting sentence, when one matched. */
  quote?: string;
}

export interface CompanionReply {
  intent: CompanionIntent;
  rung: GuardrailRung;
  text: string;
  citations: Citation[];
  /** Escalation control stays quietly present (EXPERIENCE.md ladder rule). */
  canEscalate: boolean;
  language: UiLanguage;
}

export interface GroundedChatRequest {
  question: string;
  position: ReadingPosition;
  language: UiLanguage;
}

/** Plan-structure proposal (creation chat): stage-grouped node titles. */
export interface ProposedStage {
  name: string;
  nodeTitles: string[];
}

export interface PlanStructureProposal {
  topic: string;
  stages: ProposedStage[];
  language: UiLanguage;
}

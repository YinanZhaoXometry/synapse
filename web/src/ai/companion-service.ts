/**
 * The AI seam (AD-5): every AI behavior in the app goes through this interface.
 * The static build ships the deterministic simulated adapter; FR-33's server
 * implementation replaces it here — components never touch a provider API.
 */
import type {
  CompanionReply,
  GeneratedQuestion,
  GradedAnswer,
  GroundedChatRequest,
  MaterialRef,
  PlanStructureProposal,
  QuizMode,
  UiLanguage,
} from "./types";
import type { ReadingLocator } from "@/domain/entities";
import { SimulatedCompanion } from "./simulated/companion";

export interface CompanionService {
  /** Chat grounded on a Reading Position; optional progressive emission. */
  chat(request: GroundedChatRequest, onToken?: (chunk: string) => void): Promise<CompanionReply>;

  /** Topic/goal → staged node proposal, streamed like chat. Deterministic per input. */
  generatePlanStructure(
    topic: string,
    language: UiLanguage,
    onToken?: (chunk: string) => void,
  ): Promise<PlanStructureProposal>;

  /** Materials-sourced quiz generation; questions are node-attributed at generation (AD-6, FR-18). */
  generateQuiz(input: {
    materials: MaterialRef[];
    nodeIds: string[];
    mode: QuizMode;
  }): Promise<GeneratedQuestion[]>;

  /** Materials-sourced flashcard generation (FR-19): one card per section. */
  generateFlashcards(input: { materials: MaterialRef[] }): Promise<Array<{ front: string; back: string }>>;

  /** Open-answer grading against the source section (spec rule: ≥2 hits correct, 1 partial, 0 wrong). */
  gradeOpenAnswer(input: {
    keywords: string[];
    answer: string;
    sourceText: string;
    source: ReadingLocator;
    language: UiLanguage;
  }): Promise<GradedAnswer>;
}

let instance: CompanionService | null = null;

/** Singleton access point — the future server adapter swaps in here, nowhere else. */
export function getCompanionService(): CompanionService {
  if (!instance) instance = new SimulatedCompanion();
  return instance;
}

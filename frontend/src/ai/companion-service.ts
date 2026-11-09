/**
 * The AI seam (AD-5): every AI behavior in the app goes through this interface.
 * The runtime ships the server adapter (epic P2-8 T5, FR-33); the simulated
 * adapter survives as the dev/test double (AD-18) — components never touch a
 * provider API.
 */
import type {
  CompanionReply,
  GeneratedQuestion,
  GradedAnswer,
  GroundedChatRequest,
  MaterialRef,
  PlanChatRequest,
  PlanProposalOptions,
  PlanStructureProposal,
  ProposalMaterial,
  QuizMode,
  UiLanguage,
} from "./types";
import type { ReadingLocator } from "@/domain/entities";
import { SimulatedCompanion } from "./simulated/companion";
import { ServerCompanionService } from "./companion-service-server";
import { prefersSimulatedCompanion } from "./seam-preference";

export interface CompanionService {
  /** Chat grounded on a Reading Position; optional progressive emission. */
  chat(request: GroundedChatRequest, onToken?: (chunk: string) => void): Promise<CompanionReply>;

  /**
   * Plan-level chat (FR-46, epic P2-12 T3): grounded on the WHOLE plan — no
   * ReadingPosition. The optional mistakeEntryId is the "analyze my
   * mistakes" grounding input (the entry's source section rides first; the
   * stream's citation carries the entry's own source locator). Same reply
   * contract as chat; plan_companion is always hint-first (the payload has
   * no escalation flag, so canEscalate is false).
   */
  planChat(request: PlanChatRequest, onToken?: (chunk: string) => void): Promise<CompanionReply>;

  /**
   * Topic/goal → staged node proposal, streamed like chat. Deterministic per
   * input. The goal is additive (epic P2-8 T5, A3/FR-1): the creation chat's
   * selection feeds the proposal stream's goal param; the simulated adapter
   * keeps templating from the topic alone. The trailing options carry the
   * additive restart-notice channel (epic P2-8 review fix, AD-16 — see
   * PlanProposalOptions): the server adapter fires it per fresh-ticket
   * restart; the simulated adapter ignores it.
   */
  generatePlanStructure(
    message: string,
    materials: ProposalMaterial[],
    language: UiLanguage,
    onToken?: (chunk: string) => void,
    options?: PlanProposalOptions,
  ): Promise<PlanStructureProposal>;

  /**
   * Quiz generation (AD-6, FR-18). planId/taskId are the additive pass-through
   * (epic P2-8 T5): the server adapter generates SERVER-SIDE from the
   * plan/task scope (the wire carries no sections — materials/nodeIds stay
   * the simulated adapter's local inputs); every real scope carries exactly
   * one of the two. targeting is T5's additive pass-through (epic P2-10 T5,
   * FR-21): `{ nodeId }` scopes the generation to that plan node (the node
   * Quick Test — xor planId/taskId on the wire); the simulated adapter
   * ignores it. materialId/sectionIds/targetCount are T2's additive
   * pass-through (epic-13, FR-14): the material Quick Test scope — the
   * FOURTH xor member, gated server-side on ≥1 confirmed node mapping; the
   * server adapter rides them INSTEAD of planId/taskId/targeting, and the
   * simulated adapter honors them locally (section narrowing + count cap)
   * so offline tests walk the same shape.
   */
  generateQuiz(input: {
    materials: MaterialRef[];
    nodeIds: string[];
    mode: QuizMode;
    planId?: string | null;
    taskId?: string | null;
    targeting?: { nodeId: string } | null;
    materialId?: string | null;
    sectionIds?: string[] | null;
    targetCount?: number | null;
  }): Promise<GeneratedQuestion[]>;

  /** Materials-sourced flashcard generation (FR-19): one card per section. */
  generateFlashcards(input: { materials: MaterialRef[] }): Promise<Array<{ front: string; back: string }>>;

  /**
   * Open-answer grading against the source section (spec rule: ≥2 hits
   * correct, 1 partial, 0 wrong). questionId is the additive pass-through
   * (epic P2-8 T5): the server grades by questionId — it owns the keywords
   * and the cited source; keywords/sourceText/source stay the simulated
   * adapter's local grading input.
   */
  gradeOpenAnswer(input: {
    keywords: string[];
    answer: string;
    sourceText: string;
    source: ReadingLocator;
    language: UiLanguage;
    questionId?: string;
  }): Promise<GradedAnswer>;
}

// -- the implementation picker (AD-18) -------------------------------------------

let instance: CompanionService | null = null;

/** Explicit injection — a test (or a future dev harness) swaps the seam
 * wholesale; null returns to the default pick below. */
export function setCompanionService(next: CompanionService | null): void {
  instance = next;
}

/** Singleton access point — the server adapter swapped in here (epic P2-8 T5);
 * under vitest the bootstrap's flag (src/test/setup.ts → seam-preference.ts,
 * a dependency-free leaf so the flip never drags the Apollo/stream graph into
 * the pre-mock import chain) pins the simulated double. */
export function getCompanionService(): CompanionService {
  if (!instance) {
    instance = prefersSimulatedCompanion() ? new SimulatedCompanion() : new ServerCompanionService();
  }
  return instance;
}

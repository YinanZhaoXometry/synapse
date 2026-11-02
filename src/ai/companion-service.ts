/**
 * The AI seam (AD-5): every AI behavior in the app goes through this interface.
 * The static build ships the deterministic simulated adapter; FR-33's server
 * implementation replaces it here — components never touch a provider API.
 */
import type { CompanionReply, GroundedChatRequest, PlanStructureProposal, UiLanguage } from "./types";
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
}

let instance: CompanionService | null = null;

/** Singleton access point — the future server adapter swaps in here, nowhere else. */
export function getCompanionService(): CompanionService {
  if (!instance) instance = new SimulatedCompanion();
  return instance;
}

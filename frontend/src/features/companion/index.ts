/**
 * The companion feature's public surface (AD-2): CompanionPanel is mounted by
 * the reader's dock + responsive ladder (reading mode) and by the plan home
 * drawer + /ai-tutor (plan mode, FR-46). Everything else stays internal.
 * TeachPrefill is epic-34 T2's AI 讲解 handoff (plan page shell → drawer).
 */
export { CompanionPanel } from "./CompanionPanel";
export type {
  CompanionPanelProps,
  PlanCompanionPanelProps,
  ReadingCompanionPanelProps,
  TeachPrefill,
} from "./CompanionPanel";
export { usePlanCompanionChat } from "./use-plan-companion-chat";
export type { PlanCompanionEntry, PlanTurnRequest, TeachNode } from "./use-plan-companion-chat";

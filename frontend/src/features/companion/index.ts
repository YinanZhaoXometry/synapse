/**
 * The companion feature's public surface (AD-2): CompanionPanel is mounted by
 * the reader's dock + responsive ladder (reading mode) and by the plan home
 * drawer + /ai-tutor (plan mode, FR-46). Everything else stays internal.
 */
export { CompanionPanel } from "./CompanionPanel";
export type { CompanionPanelProps, PlanCompanionPanelProps, ReadingCompanionPanelProps } from "./CompanionPanel";
export { usePlanCompanionChat } from "./use-plan-companion-chat";
export type { PlanCompanionEntry, PlanTurnRequest } from "./use-plan-companion-chat";

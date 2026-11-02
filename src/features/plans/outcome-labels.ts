/**
 * Outcome → i18n-key map (review dedup): the single source for outcome labels,
 * read by both the OutcomeMark atom and the Plan Home evidence-popover legend.
 * Lives beside the atoms in its own module so atoms.tsx stays components-only
 * (react-refresh).
 */
import type { Outcome } from "@/domain/entities";

export const OUTCOME_LABEL_KEY: Record<Outcome, string> = {
  correct: "plans.outcomeCorrect",
  partial: "plans.outcomePartial",
  wrong: "plans.outcomeWrong",
};

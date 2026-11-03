/**
 * Outcome → presentation tokens (epic-6 T2): the verdict pill/tint/label per
 * outcome, shared by the runner's verdict panel and the results breakdown.
 * Keys reuse the shared outcome vocabulary (plans.* labels); the forfeited
 * variant is layered in the UI (quiz.forfeited pill) — a forfeit IS a wrong
 * (ADR-0001), so it shares the wrong visuals.
 */
import type { Outcome } from "@/domain/entities";

export const OUTCOME_STATUS: Record<Outcome, { pill: string; ink: string; labelKey: string }> = {
  correct: { pill: "pill-mastered", ink: "text-mastered-ink", labelKey: "quiz.correct" },
  partial: { pill: "pill-partial", ink: "text-partial-ink", labelKey: "quiz.partial" },
  wrong: { pill: "tint-danger", ink: "text-danger-ink", labelKey: "quiz.wrong" },
};

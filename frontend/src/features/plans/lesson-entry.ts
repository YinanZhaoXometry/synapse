/**
 * The lesson-entry pure derivations (epic-36 T2). The components stay
 * presentational — these two functions carry everything testable:
 *
 * `nodeLessonMaterial` mirrors the SERVER's per-node singleton client-side
 * (origin=generated ∧ nodeId pinned — spec decision 5): found → the action
 * deforms into 「打开讲义」; null → the create path. The materials read is
 * the caller's (Plan Home already holds it); undefined → null (never a
 * guessed lesson).
 *
 * `lessonEntryHint` composes the entry's cost hint from the TWO server
 * reads (FR-16: decide with the numbers in front of you) — the template-
 * derived estimate band and today's remaining cap. Never a hand-written
 * figure (spec decision 10); anything still in flight renders nothing.
 */
import type { AiUsageTodayView } from "@/api/queries/settings-queries";
import type { LessonEstimateView } from "@/api/queries/lesson-queries";
import type { MaterialView } from "@/api/views";
import type { NodeStateTranslate } from "./node-state";

export function nodeLessonMaterial(materials: MaterialView[] | undefined, nodeId: string): MaterialView | null {
  return materials?.find((material) => material.origin === "generated" && material.nodeId === nodeId) ?? null;
}

export function lessonEntryHint(
  estimate: LessonEstimateView | undefined,
  usage: AiUsageTodayView | undefined,
  t: NodeStateTranslate,
): string | null {
  if (!estimate || !usage) return null;
  const remaining = Math.max(0, usage.dailyLimit - usage.callsToday);
  // epic-36 T3: the ① confirm popover feeds the SAME composer the exact
  // outline's estimate (totalMin === totalMax — the server's template math on
  // the confirmed chapter count), so it renders the single-number copy; the
  // node variant's band keeps the range copy. One cost source, two consumers.
  if (estimate.totalMin === estimate.totalMax) {
    return t("materials.lessonCostExact", { n: estimate.totalMin, r: remaining });
  }
  return t("plans.nodeLessonHint", { min: estimate.totalMin, max: estimate.totalMax, r: remaining });
}

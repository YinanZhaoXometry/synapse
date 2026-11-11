/**
 * The materials-hub lesson-entry pure derivations (epic-36 T3 — the ① gate).
 * Everything testable about the hub's lesson surfaces lives HERE; the page
 * and row stay presentational:
 *
 * `materialLessonMaterial` mirrors the SERVER's per-source-material singleton
 * client-side (origin=generated ∧ variant=material ∧ sourceMaterialIds
 * carries the source — spec decision 5's ① half; T2's nodeLessonMaterial is
 * the ② half): found → the row action deforms into 「打开讲义」, never a
 * second create. The materials read is the caller's (the hub already holds
 * full rows); undefined → null (never a guessed lesson).
 *
 * `lessonGateReason` is the row action's honesty gate (parsed ∧ ≥1 section —
 * markdown or pdf alike; a generated lesson itself never reaches it, the
 * page routes those rows to open/regenerate): null = actionable, otherwise
 * the reason vocabulary the button renders.
 *
 * `lessonRowState` derives the hub row's generation-state chip from the
 * generation jsonb verbatim (spec decision 2 — never re-derived from
 * sections): pausedKind wins (已暂停可续), owed chapters → 进行中, complete
 * → no state chip at all.
 */
import type { MaterialView, LessonGenerationView } from "@/api/views";

export function materialLessonMaterial(materials: MaterialView[] | undefined, sourceMaterialId: string): MaterialView | null {
  return (
    materials?.find(
      (material) =>
        material.origin === "generated" &&
        material.generation?.variant === "material" &&
        material.generation.sourceMaterialIds.includes(sourceMaterialId),
    ) ?? null
  );
}

/** The gate reason vocabulary: why 生成讲义 is disabled, or null when the
 * material is actionable. `parsing` covers pending+parsing alike (the parse
 * chip beside it already distinguishes them — one reason here is honest). */
export type LessonGateReason = "parsing" | "failed" | "empty";

export function lessonGateReason(material: MaterialView): LessonGateReason | null {
  if (material.parseState === "pending" || material.parseState === "parsing") return "parsing";
  if (material.parseState === "failed") return "failed";
  if (material.sections.length === 0) return "empty";
  return null;
}

/** The row's live generation state: "active" (进行中 — chapters still owed,
 * nothing paused), "paused" (已暂停可续 — pausedKind set), or null (complete
 * — the origin chip alone tells the story). */
export function lessonRowState(generation: LessonGenerationView): "active" | "paused" | null {
  if (generation.pausedKind) return "paused";
  return generation.outline.some((chapter) => chapter.status !== "ready") ? "active" : null;
}

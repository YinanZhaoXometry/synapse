/**
 * The AI 讲义 hooks (epic-36 T2). `useLessonEstimateQuery` reads the server's
 * ONE template-derived cost source (spec decision 10 — the entry renders the
 * estimate's numbers, never a hand-written cost table); the node variant's
 * estimate is a template property, so every node row's identical query
 * dedupes into ONE cache read per plan page. `useCreateLessonMutation` lands
 * the unified create (② plan+node) and sweeps the list + plan reads — the
 * lesson is a material everywhere, so the reads are truth.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AiUsageTodayDocument,
  CreateLessonDocument,
  LessonEstimateDocument,
  MaterialsDocument,
  PlanDocument,
  ProposeLessonOutlineDocument,
} from "@/types/graphql";

/** The estimate view (FR-16): the server's call-band numbers, rendered verbatim. */
export interface LessonEstimateView {
  outlineCalls: number;
  sectionsMin: number;
  sectionsMax: number;
  totalMin: number;
  totalMax: number;
}

export function useLessonEstimateQuery(variant: "node" | "material", sectionCount?: number) {
  const result = useQuery(LessonEstimateDocument, {
    variables: { variant, sectionCount },
  });
  const estimate: LessonEstimateView | undefined = result.data?.lessonEstimate
    ? {
        outlineCalls: result.data.lessonEstimate.outlineCalls,
        sectionsMin: result.data.lessonEstimate.sectionsMin,
        sectionsMax: result.data.lessonEstimate.sectionsMax,
        totalMin: result.data.lessonEstimate.totalMin,
        totalMax: result.data.lessonEstimate.totalMax,
      }
    : undefined;
  return { data: result.data !== undefined ? estimate : undefined, loading: result.loading && !result.data, error: result.error };
}

export function useCreateLessonMutation() {
  return useMutation(CreateLessonDocument, {
    // The lesson is a FULL material: the plan's list + detail association and
    // every material summary list must see it (the attachMaterial sweep).
    refetchQueries: [MaterialsDocument, PlanDocument],
  });
}

/**
 * The ① propose gate (epic-36 T3, spec decision 5): one cap-counted, stateless
 * outline call — nothing persists, so no material reads to sweep; the cap
 * counter's read IS swept (the confirm popover's remaining-cap figure must
 * include the propose call just spent). The reply is echoed verbatim into
 * createLesson — the hook returns the raw payload, the caller maps.
 */
export function useProposeLessonOutlineMutation() {
  return useMutation(ProposeLessonOutlineDocument, {
    refetchQueries: [AiUsageTodayDocument],
  });
}

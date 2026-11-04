/**
 * Plan query hooks (AD-18, epic P2-8 T1): the features-only consumption path,
 * now over the Apollo typed-document layer. The names match the retired
 * TanStack hooks one-for-one; results are mapped domain views — plans and
 * nodes carry SERVER mastery scores (AD-14: render, never recompute).
 *
 * Convention for every hook in src/api/queries:
 *   queries  → { data (mapped view | undefined), loading, error, refetch }
 *   mutations→ the raw Apollo [mutate, result] tuple; documents declare their
 *              refetch sweeps so the cache stays coherent without call-site care.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CreatePlanDocument,
  DeletePlanDocument,
  MaterialsDocument,
  PlanDocument,
  PlansDocument,
  ReadingProgressListDocument,
  UpdatePlanDocument,
} from "@/types/graphql";
import { mapMaterialSummary, mapNode } from "../mappers";
import type { KnowledgeNodeView, MaterialView, StudyPlanView } from "../views";

export interface PlanDetail {
  plan: StudyPlanView;
  nodes: KnowledgeNodeView[];
  materials: MaterialView[];
}

export function usePlansQuery() {
  const result = useQuery(PlansDocument);
  const plans: StudyPlanView[] = (result.data?.plans ?? []).map((plan) => ({
    id: plan.id,
    topic: plan.topic,
    goal: plan.goal,
    nodeIds: [], // associations realize the arrays — nodes ride usePlanNodesQuery / Plan detail
    materialIds: [],
    createdAt: plan.createdAt,
    masteryScore: plan.masteryScore,
  }));
  return { data: result.loading ? undefined : plans, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function usePlanQuery(planId: string) {
  const result = useQuery(PlanDocument, { variables: { id: planId }, skip: !planId });
  let detail: PlanDetail | undefined;
  if (!result.loading && result.data?.plan) {
    const row = result.data.plan;
    detail = {
      plan: {
        id: row.id,
        topic: row.topic,
        goal: row.goal,
        nodeIds: [],
        materialIds: [],
        createdAt: row.createdAt,
        masteryScore: row.masteryScore,
      },
      nodes: row.nodes.map(mapNode),
      materials: row.materials.map(mapMaterialSummary),
    };
  }
  return { data: detail, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function usePlanNodesQuery(planId: string) {
  const result = useQuery(PlanDocument, { variables: { id: planId }, skip: !planId });
  const nodes: KnowledgeNodeView[] = (result.data?.plan?.nodes ?? []).map(mapNode);
  const materials: MaterialView[] = (result.data?.plan?.materials ?? []).map(mapMaterialSummary);
  return {
    data: result.loading ? undefined : nodes,
    materials: result.loading ? undefined : materials,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useCreatePlanMutation() {
  // payload writes plan + nodes into the cache; the list needs the new row.
  return useMutation(CreatePlanDocument, { refetchQueries: [PlansDocument] });
}

export function useUpdatePlanMutation() {
  // full plan returns → normalized write covers detail + list rows.
  return useMutation(UpdatePlanDocument);
}

export function useDeletePlanMutation() {
  return useMutation(DeletePlanDocument, {
    // the cascade removes the plan's materials/threads server-side; sweep the
    // surfaces that aggregated across plans so nothing dead lingers.
    refetchQueries: [PlansDocument, MaterialsDocument, ReadingProgressListDocument],
    update(cache, { data }) {
      const deletedPlanId = data?.deletePlan.deletedPlanId;
      if (deletedPlanId) {
        cache.evict({ id: cache.identify({ __typename: "StudyPlan", id: deletedPlanId }) });
        cache.gc();
      }
    },
  });
}

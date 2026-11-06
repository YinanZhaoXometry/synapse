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
  PlanMistakeEntriesDocument,
  PlansDocument,
  ReadingProgressListDocument,
  SetPlanVisibilityDocument,
  UpdatePlanDocument,
} from "@/types/graphql";
import { mapMaterialSummary, mapNode, readingLocator } from "../mappers";
import type { KnowledgeNodeView, MaterialView, StudyPlanView } from "../views";
import type { ReadingLocator } from "@/domain/entities";

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
    visibility: plan.visibility === "public" ? "public" : "private",
    forkedFromTopic: plan.forkedFromTopic,
    edges: [], // same association posture — edges ride the Plan detail query (epic-16)
  }));
  return { data: result.data !== undefined ? plans : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function usePlanQuery(planId: string) {
  const result = useQuery(PlanDocument, { variables: { id: planId }, skip: !planId });
  let detail: PlanDetail | undefined;
  if (result.data?.plan) {
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
        // FR-38 (epic P2-11 T1): the server's own column — rendered by the
        // plan settings control, never recomputed (AD-14 posture).
        visibility: row.visibility === "public" ? "public" : "private",
        // OQ-12 (epic P2-11 T3): the attribution snapshot — rendered by the
        // plan home header, never recomputed.
        forkedFromTopic: row.forkedFromTopic,
        // epic-16 (FR-5): the persisted prerequisite edges, endpoint uuids
        // verbatim — the graph's DAG input, selected per-plan by edge presence.
        edges: row.edges.map((edge) => ({ fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId })),
      },
      nodes: row.nodes.map(mapNode),
      materials: row.materials.map(mapMaterialSummary),
    };
  }
  return { data: detail, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function usePlanNodesQuery(planId: string) {
  const result = useQuery(PlanDocument, { variables: { id: planId }, skip: !planId });
  const nodes: KnowledgeNodeView[] = (result.data?.plan?.nodes ?? []).map(mapNode);
  const materials: MaterialView[] = (result.data?.plan?.materials ?? []).map(mapMaterialSummary);
  return {
    data: result.data !== undefined ? nodes : undefined,
    materials: result.data !== undefined ? materials : undefined,
    loading: result.loading && !result.data,
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

/**
 * The FR-38 visibility flip (epic P2-11 T1): the plan settings control's
 * write. The mutation returns the full plan row (normalized cache write) and
 * the Plan read-back sweep re-reads the detail — the chip flips from server
 * truth, never optimism (the MaterialScopeControls precedent).
 */
export function useSetPlanVisibilityMutation() {
  return useMutation(SetPlanVisibilityDocument, { refetchQueries: [PlanDocument] });
}

/**
 * One plan's mistake entries (FR-46, epic P2-12 T3): the plan companion's
 * "analyze my mistakes" picker read — every entry whose node belongs to the
 * plan, in log order, shaped for the picker rows (the question's prompt +
 * source pair, the learner's answer, the log date). A plain list over the
 * Apollo seam; NOT_FOUND (foreign plan) surfaces through error.
 */
export interface PlanMistakeEntryView {
  id: string;
  questionId: string;
  nodeId: string;
  prompt: string;
  sourceMaterialId: string;
  sourceSectionId: string;
  /** The entry's own source locator (FR-23) — the grounded turn's chip target. */
  sourceLocation: ReadingLocator;
  userAnswer: string;
  forfeited: boolean;
  createdAt: string;
}

export function usePlanMistakeEntriesQuery(planId: string) {
  const result = useQuery(PlanMistakeEntriesDocument, { variables: { planId }, skip: !planId });
  const rows: PlanMistakeEntryView[] = (result.data?.planMistakeEntries ?? []).map((row) => ({
    id: row.id,
    questionId: row.questionId,
    nodeId: row.nodeId,
    prompt: row.question.prompt,
    sourceMaterialId: row.question.sourceMaterialId,
    sourceSectionId: row.question.sourceSectionId,
    sourceLocation: readingLocator(row.sourceLocation),
    userAnswer: row.userAnswer,
    forfeited: row.forfeited,
    createdAt: row.createdAt,
  }));
  return {
    data: result.data !== undefined ? rows : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

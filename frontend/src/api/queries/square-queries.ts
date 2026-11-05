/**
 * Square query hooks (AD-18, epic P2-11 T3): the 广场 tab's public reads
 * (squarePlans / squarePlan — the reduced SquarePlanType structure set, the
 * AD-13 exception) + the authenticated adopt fork. The fork is a NORMAL
 * plan-create: the mutation returns the full plan row (normalized cache
 * write) + its nodes, and the plans-list read-back sweep re-reads 我要学 so
 * the adopted plan appears immediately. Attribution (forkedFromTopic) rides
 * the plan views — rendering reads it, never re-derives it.
 *
 * Convention for every hook in src/api/queries:
 *   queries  → { data (mapped view | undefined), loading, error, refetch }
 *   mutations→ the raw Apollo [mutate, result] tuple; documents declare their
 *              refetch sweeps so the cache stays coherent without call-site care.
 *   creates  → mint the client uuid with newClientUuid() at the call site (AD-12)
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { ForkSquarePlanDocument, PlansDocument, SquarePlanDocument, SquarePlansDocument } from "@/types/graphql";
import { mapNode } from "../mappers";
import type { KnowledgeNodeView } from "../views";

/** One node of a public plan — title/stage/order ONLY (the reduced set). */
export interface SquareNodeSummaryView {
  title: string;
  stage: string | null;
  order: number;
}

/** One public plan's structure-only Square view (no scores/content exist). */
export interface SquarePlanView {
  id: string;
  topic: string;
  goal: string | null;
  /** Always "public" server-side — the Square only answers publicly_visible plans. */
  visibility: "public";
  createdAt: string;
  nodeSummaries: SquareNodeSummaryView[];
}

function mapSquarePlan(row: {
  id: string;
  topic: string;
  goal: string | null;
  visibility: string;
  createdAt: string;
  nodeSummaries: Array<{ title: string; stage: string | null; order: number }>;
}): SquarePlanView {
  return {
    id: row.id,
    topic: row.topic,
    goal: row.goal,
    visibility: "public",
    createdAt: row.createdAt,
    nodeSummaries: [...row.nodeSummaries].sort((a, b) => a.order - b.order),
  };
}

export function useSquarePlansQuery() {
  const result = useQuery(SquarePlansDocument);
  const plans: SquarePlanView[] = (result.data?.squarePlans ?? []).map(mapSquarePlan);
  return { data: result.data !== undefined ? plans : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useSquarePlanQuery(planId: string) {
  const result = useQuery(SquarePlanDocument, { variables: { id: planId }, skip: !planId });
  const detail: SquarePlanView | undefined = result.data?.squarePlan ? mapSquarePlan(result.data.squarePlan) : undefined;
  return { data: detail, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/**
 * The adopt (FR-39 web half, OQ-12): fork a public Square plan into the
 * caller's library — private, attributed, structure-only. The plans-list
 * read-back sweep (the 我要学 list must show the new plan); nodes return
 * mapped views so the adopt flow can hand straight to the plan home.
 */
export function useForkSquarePlanMutation() {
  return useMutation(ForkSquarePlanDocument, { refetchQueries: [PlansDocument] });
}

/** The fork mutation's node payload, mapped to the domain view. */
export type ForkedPlanNodes = KnowledgeNodeView[];

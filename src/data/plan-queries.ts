/**
 * Plan/Node Query hooks (AD-3): the only way features touch plan data —
 * useQuery/useMutation over the repository, mutations invalidating affected keys.
 * No React context for domain data; hooks stay thin over the repository API.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KnowledgeNode, StudyPlan } from "@/domain/entities";
import {
  createPlan,
  deletePlan,
  getPlan,
  listNodesByPlan,
  listPlans,
  updatePlan,
  type CreatePlanNodeInput,
} from "./plan-repository";
import { queryKeys } from "./query-keys";

export function usePlansQuery() {
  return useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: listPlans,
  });
}

export function usePlanQuery(planId: string) {
  return useQuery({
    queryKey: queryKeys.plans.detail(planId),
    queryFn: () => getPlan(planId),
  });
}

export function usePlanNodesQuery(planId: string) {
  return useQuery({
    queryKey: queryKeys.plans.nodes(planId),
    queryFn: () => listNodesByPlan(planId),
  });
}

export function useCreatePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topic: string; goal: string | null; nodes: CreatePlanNodeInput[] }) =>
      createPlan(input),
    onSuccess: ({ plan }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans.all });
      void qc.invalidateQueries({ queryKey: queryKeys.plans.nodes(plan.id) });
    },
  });
}

export function useUpdatePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<StudyPlan, "topic" | "goal">> }) =>
      updatePlan(id, patch),
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans.all });
      void qc.invalidateQueries({ queryKey: queryKeys.plans.detail(id) });
    },
  });
}

export function useDeletePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      deletePlan(planId);
    },
    onSuccess: (_deleted, planId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans.all });
      void qc.removeQueries({ queryKey: queryKeys.plans.detail(planId) });
      void qc.removeQueries({ queryKey: queryKeys.plans.nodes(planId) });
    },
  });
}

export type { CreatePlanNodeInput, KnowledgeNode, StudyPlan };

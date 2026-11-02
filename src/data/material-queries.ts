/** Material Query hooks (AD-3): the features-only consumption path. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMaterial,
  listMaterialsByPlan,
  listMaterialsByTask,
  registerMaterial,
  type RegisterMaterialInput,
} from "./material-repository";
import { queryKeys } from "./query-keys";

export function useMaterialQuery(materialId: string) {
  return useQuery({
    queryKey: queryKeys.materials.detail(materialId),
    queryFn: () => getMaterial(materialId),
  });
}

export function usePlanMaterialsQuery(planId: string) {
  return useQuery({
    queryKey: queryKeys.materials.byPlan(planId),
    queryFn: () => listMaterialsByPlan(planId),
  });
}

export function useTaskMaterialsQuery(taskId: string) {
  return useQuery({
    queryKey: queryKeys.materials.byTask(taskId),
    queryFn: () => listMaterialsByTask(taskId),
  });
}

export function useRegisterMaterialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterMaterialInput) => registerMaterial(input),
    onSuccess: ({ material }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.materials.all });
      if (material.planId) {
        void qc.invalidateQueries({ queryKey: queryKeys.plans.detail(material.planId) });
      }
    },
  });
}

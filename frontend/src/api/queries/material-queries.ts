/**
 * Material query hooks (AD-18, epic P2-8 T1). The Phase-1 one-call
 * registerMaterial becomes the cutover's two-step flow: createMaterialUpload
 * mints the presigned PUT, the browser PUTs the bytes to storage, and
 * attachMaterial lands the metadata + client-extracted sections (epic P2-6
 * contract). Idempotency rides the client-supplied uuid (AD-12) — minted with
 * newClientUuid() at the call site.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AttachMaterialDocument,
  CreateMaterialUploadDocument,
  MaterialDocument,
  MaterialsDocument,
  PlanDocument,
  SetMaterialParseResultDocument,
} from "@/types/graphql";
import { mapMaterial, mapMaterialSummary } from "../mappers";
import type { MaterialView } from "../views";

/** Client-supplied uuid for every create-shaped mutation (AD-12 idempotency key). */
export function newClientUuid(): string {
  return crypto.randomUUID();
}

export function useMaterialQuery(materialId: string) {
  const result = useQuery(MaterialDocument, { variables: { id: materialId }, skip: !materialId });
  const material = result.data?.material ? mapMaterial(result.data.material) : undefined;
  return { data: result.loading ? undefined : material, loading: result.loading, error: result.error, refetch: result.refetch };
}

/** Every material across plans (Plans Home continue line, FR-25). */
export function useAllMaterialsQuery() {
  const result = useQuery(MaterialsDocument, { variables: {} });
  const materials = (result.data?.materials ?? []).map(mapMaterialSummary);
  return { data: result.loading ? undefined : materials, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function usePlanMaterialsQuery(planId: string) {
  const result = useQuery(MaterialsDocument, { variables: { planId }, skip: !planId });
  const materials = (result.data?.materials ?? []).map(mapMaterialSummary);
  return { data: result.loading ? undefined : materials, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useTaskMaterialsQuery(taskId: string) {
  const result = useQuery(MaterialsDocument, { variables: { taskId }, skip: !taskId });
  const materials = (result.data?.materials ?? []).map(mapMaterialSummary);
  return { data: result.loading ? undefined : materials, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useCreateMaterialUploadMutation() {
  // presign only — nothing cached to sweep; the PUT goes straight to storage.
  return useMutation(CreateMaterialUploadDocument);
}

export function useAttachMaterialMutation() {
  return useMutation(AttachMaterialDocument, {
    // payload returns the full material (normalized write), but the summary
    // lists + the plan's materials association need the sweep.
    refetchQueries: [MaterialsDocument, PlanDocument],
  });
}

export function useSetMaterialParseResultMutation() {
  return useMutation(SetMaterialParseResultDocument, {
    // full material returns → normalized write; lists share the row's refs.
    refetchQueries: [MaterialsDocument],
  });
}

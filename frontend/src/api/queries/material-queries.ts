/**
 * Material query hooks (AD-18, epic P2-8 T1). The Phase-1 one-call
 * registerMaterial becomes the cutover's two-step flow: createMaterialUpload
 * mints the presigned PUT, the browser PUTs the bytes to storage, and
 * attachMaterial lands the metadata + client-extracted sections (epic P2-6
 * contract). Idempotency rides the client-supplied uuid (AD-12) — minted with
 * newClientUuid() at the call site.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { sessionBlobs } from "@/lib/session-blobs";
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

/** Every material across plans (Plans Home continue line, FR-25). Full rows:
 *  the continue line resolves locators against sections, and quiz generation
 *  sources sections — lists carry the whole material. */
export function useAllMaterialsQuery() {
  const result = useQuery(MaterialsDocument, { variables: {} });
  const materials = (result.data?.materials ?? []).map(mapMaterial);
  return { data: result.loading ? undefined : materials, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function usePlanMaterialsQuery(planId: string) {
  const result = useQuery(MaterialsDocument, { variables: { planId }, skip: !planId });
  const materials = (result.data?.materials ?? []).map(mapMaterial);
  return { data: result.loading ? undefined : materials, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useTaskMaterialsQuery(taskId: string) {
  const result = useQuery(MaterialsDocument, { variables: { taskId }, skip: !taskId });
  const materials = (result.data?.materials ?? []).map(mapMaterial);
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

/**
 * The cutover's upload surface (epic P2-6 + T1):
 *   - attach: one call for the new-material flows — attach the material row
 *     (clientUuid-idempotent), mint the presigned PUT, push the bytes straight
 *     to storage (never through the api), and park them in the session-blob
 *     registry for this session's reader. The caller then parses eagerly
 *     (AD-7) and lands the outcome via useSetMaterialParseResultMutation.
 *   - refreshBytes: re-upload for an EXISTING material row — fresh presign,
 *     PUT, session registry; the row's metadata and id stay untouched (FR-29).
 * Both throw on any step's failure — callers render the honest failure, never
 * a fake upload.
 */
export function useMaterialUpload() {
  const [attachMaterial] = useAttachMaterialMutation();
  const [createUpload] = useCreateMaterialUploadMutation();

  const refreshBytes = async (materialId: string, file: File): Promise<void> => {
    const contentType = file.type === "application/pdf" ? "application/pdf" : "text/markdown";
    const presigned = await createUpload({
      variables: {
        input: { materialId, filename: file.name, contentType, size: file.size },
      },
    });
    const uploadUrl = presigned.data?.createMaterialUpload?.uploadUrl;
    if (!uploadUrl) throw new Error("presign failed: no uploadUrl in payload");
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`storage PUT failed: HTTP ${put.status}`);
    sessionBlobs.put(materialId, file);
  };

  const attach = async (input: {
    file: File;
    title: string;
    kind: "pdf" | "markdown";
    planId: string | null;
    taskId: string | null;
  }): Promise<MaterialView> => {
    const contentType = input.kind === "pdf" ? "application/pdf" : "text/markdown";
    const attached = await attachMaterial({
      variables: {
        input: {
          clientUuid: newClientUuid(),
          title: input.title,
          kind: input.kind,
          sizeBytes: input.file.size,
          planId: input.planId,
          taskId: input.taskId,
          sections: [],
          parseState: "pending",
        },
      },
    });
    const material = attached.data?.attachMaterial?.material;
    if (!material) throw new Error("attach failed: no material in payload");

    const presigned = await createUpload({
      variables: {
        input: {
          materialId: material.id,
          filename: input.file.name,
          contentType,
          size: input.file.size,
        },
      },
    });
    const uploadUrl = presigned.data?.createMaterialUpload?.uploadUrl;
    if (!uploadUrl) throw new Error("presign failed: no uploadUrl in payload");

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: input.file,
    });
    if (!put.ok) throw new Error(`storage PUT failed: HTTP ${put.status}`);

    sessionBlobs.put(material.id, input.file);
    return mapMaterial(material);
  };

  return { attach, refreshBytes };
}

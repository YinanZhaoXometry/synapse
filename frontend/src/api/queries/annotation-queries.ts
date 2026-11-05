/**
 * Annotation hooks (FR-16, epic-13 T3): the reader's per-material
 * annotation read (newest-first) + the add/remove writes, each write
 * carrying the list read-back sweep — the fresh list is the render truth
 * (the engine re-applies from it; nothing is appended client-side).
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { AddAnnotationDocument, AnnotationsDocument, RemoveAnnotationDocument } from "@/types/graphql";
import { mapAnnotation } from "../mappers";
import type { Annotation } from "@/domain/entities";

export function useAnnotationsQuery(materialId: string) {
  const result = useQuery(AnnotationsDocument, { variables: { materialId }, skip: !materialId });
  const rows = (result.data?.annotations ?? []).map(mapAnnotation);
  return {
    data: result.data !== undefined ? rows : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Add one annotation (kind/color/body optional — the chips send kind+color, empty body). */
export function useAddAnnotationMutation() {
  return useMutation(AddAnnotationDocument, {
    // The read-back is truth: the sweep re-applies the annotation through
    // the engine and survives reload (Apollo cache + the server row).
    refetchQueries: [AnnotationsDocument],
  });
}

/** Remove one annotation by id (the list panel's per-item delete). */
export function useRemoveAnnotationMutation() {
  return useMutation(RemoveAnnotationDocument, {
    refetchQueries: [AnnotationsDocument],
  });
}

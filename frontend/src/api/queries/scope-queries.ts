/**
 * Material attachment-scope hooks (FR-44, epic P2-10 T2): pin a material to
 * one plan node or widen it back plan-wide. The mutation returns the full
 * updated summary row — Apollo's normalized cache write updates every
 * material list reading that row in place — and the hook additionally sweeps
 * the Materials read so the lists' own queries re-resolve honestly (the
 * mapping hooks' read-back-is-truth posture).
 */
import { useMutation } from "@apollo/client/react";
import { MaterialsDocument, SetMaterialScopeDocument } from "@/types/graphql";

export function useSetMaterialScopeMutation() {
  return useMutation(SetMaterialScopeDocument, {
    // The payload's material carries the new scope (normalized write), but
    // the plan's materials list + the all-materials lists read their own
    // queries — the sweep keeps every list honest.
    refetchQueries: [MaterialsDocument],
  });
}

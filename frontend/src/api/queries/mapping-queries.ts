/**
 * Material↔node mapping hooks (FR-45, epic P2-10 T1; delta decisions 3+4).
 * The per-material coverage read feeds the coverage panel's four groups; the
 * three mutations carry the AI map run and the user's bulk verdicts. Every
 * mutation refetches the mapping list — rows change identity in place
 * (status/node transitions), so the read-back is the honest state.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  ConfirmMappingProposalsDocument,
  MaterialNodeMappingsDocument,
  MaterialsMapSectionsDocument,
  RejectMappingProposalsDocument,
} from "@/types/graphql";
import { mapMaterialNodeMapping } from "../mappers";
import type { MaterialNodeMappingView } from "../views";

export function useMaterialNodeMappingsQuery(materialId: string) {
  const result = useQuery(MaterialNodeMappingsDocument, { variables: { materialId }, skip: !materialId });
  const rows = (result.data?.materialNodeMappings ?? []).map(mapMaterialNodeMapping);
  return {
    data: result.data !== undefined ? rows : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

/** The AI map run (FR-45): every section lands in exactly one final state. */
export function useMaterialsMapSectionsMutation() {
  return useMutation(MaterialsMapSectionsDocument, {
    // rows upsert in place + new orphans appear — the list read-back is truth.
    refetchQueries: [MaterialNodeMappingsDocument],
  });
}

/** Bulk confirm: a proposed-title group becomes ONE real plan node. */
export function useConfirmMappingProposalsMutation() {
  return useMutation(ConfirmMappingProposalsDocument, {
    refetchQueries: [MaterialNodeMappingsDocument],
  });
}

/** Bulk reject: rows persist rejected — the map run never re-proposes them. */
export function useRejectMappingProposalsMutation() {
  return useMutation(RejectMappingProposalsDocument, {
    refetchQueries: [MaterialNodeMappingsDocument],
  });
}

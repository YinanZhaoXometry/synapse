/**
 * Mastery Marking claim hooks (FR-15, epic-15 T2). The per-material claim
 * read feeds the reader's green marking state; the two mutations carry the
 * claim/unmark. Both mutations sweep the claim list — rows are history
 * (claim→unclaim→re-claim accumulates rows) and the read-back is the honest
 * state; the open claims are derived client-side from `clearedAt == null`.
 * A claim is NEVER evidence: nothing here touches mastery fields (AD-14) and
 * no clientMutationId is minted (AD-12 — the inputs have no client uuid).
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  ClaimSectionDocument,
  SectionMarkingsDocument,
  UnclaimSectionDocument,
} from "@/types/graphql";
import { mapSectionMarking } from "../mappers";
import type { SectionMarkingView } from "../views";

/**
 * All of a material's claim rows (open + cleared), newest first as the server
 * returns them — never re-sorted client-side; the consumer derives the open
 * claims (`clearedAt == null`).
 */
export function useSectionMarkingsQuery(materialId: string) {
  const result = useQuery(SectionMarkingsDocument, { variables: { materialId }, skip: !materialId });
  const rows = (result.data?.sectionMarkings ?? []).map(mapSectionMarking);
  return {
    data: result.data !== undefined ? rows : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Mark a section — the claim, never evidence. Re-claiming an already-open
 * section returns that row unchanged (the server's claim law). */
export function useClaimSectionMutation() {
  return useMutation(ClaimSectionDocument, {
    // The claim list is the one read the green state derives from — the
    // read-back carries the fresh (or unchanged) row honestly.
    refetchQueries: [SectionMarkingsDocument],
  });
}

/** Unmark a section: claimedAt stands, clearedAt is set — history stays. */
export function useUnclaimSectionMutation() {
  return useMutation(UnclaimSectionDocument, {
    // Same sweep: the cleared row (clearedAt now set) rides the read-back.
    refetchQueries: [SectionMarkingsDocument],
  });
}

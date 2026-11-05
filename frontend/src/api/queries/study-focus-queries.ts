/**
 * Study Focus hooks (FR-17, epic-13 T4): the reader's per-material active
 * set read (or null — never distilled) + the synchronous generation
 * mutation, carrying the read-back sweep — the fresh set is the render
 * truth (the vN generation chip reads the refetched row; nothing is
 * patched client-side).
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { GenerateStudyFocusDocument, StudyFocusDocument } from "@/types/graphql";
import { mapStudyFocusSet } from "../mappers";

export function useStudyFocusQuery(materialId: string) {
  const result = useQuery(StudyFocusDocument, { variables: { materialId }, skip: !materialId });
  const set = result.data?.studyFocus ? mapStudyFocusSet(result.data.studyFocus) : null;
  return {
    data: result.data !== undefined ? set : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Generate (or regenerate — the server replaces the active set and bumps
 * its generation counter) one material's Study Focus from its annotations.
 * Synchronous through the adapter: one cap-counted provider call, replay
 * on the client uuid (mint a fresh one per generate click).
 */
export function useGenerateStudyFocusMutation() {
  return useMutation(GenerateStudyFocusDocument, {
    // The read-back is truth: the sweep lands the replaced set (items +
    // generation) — the panel never mutates client-side.
    refetchQueries: [StudyFocusDocument],
  });
}

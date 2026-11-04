/**
 * Note hooks (FR-40, epic P2-12 T1; delta decisions 3+5). The plan-scoped
 * notes read feeds the plan home's 学习笔记 section (the server unions the
 * plan's own notes with the ones scoped to its nodes and materials — the
 * exactly-one scope check puts every note on exactly one id). The generate
 * mutation is synchronous through the adapter (one cap-counted provider
 * call, replay on the client uuid) and carries the list read-back sweep —
 * the new note must reach the list, and the sweep is the honest state.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { GenerateNoteDocument, PlanNotesDocument } from "@/types/graphql";
import { mapNote } from "../mappers";
import type { NoteView } from "../views";

export function usePlanNotesQuery(planId: string) {
  const result = useQuery(PlanNotesDocument, { variables: { planId }, skip: !planId });
  const rows = (result.data?.notes ?? []).map(mapNote);
  return {
    data: result.data !== undefined ? rows : undefined,
    loading: result.loading && !result.data,
    error: result.error,
    refetch: result.refetch,
  };
}

/** The AI note run (FR-40): scope picker + optional user-requested enrichAt annotation. */
export function useGenerateNoteMutation() {
  return useMutation(GenerateNoteDocument, {
    // A new note lands in the plan's list — the read-back is truth (the
    // section never appends client-side).
    refetchQueries: [PlanNotesDocument],
  });
}

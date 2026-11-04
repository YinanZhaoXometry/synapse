/**
 * The first-login import hook (epic P2-8 T3, AD-15): the whole-document
 * mutation. The payload's success counts feed the toast; the refetch sweep
 * (plans + tasks + materials + progress) is declared here so the freshly
 * imported server rows reach every open surface without call-site care.
 * Call sites feed `input.document` from local-document's
 * toImportDocumentInput — the doc's own uuids are the idempotency keys
 * (AD-12), so a retry is always safe.
 */
import { useMutation } from "@apollo/client/react";
import {
  ImportDocumentDocument,
  MaterialsDocument,
  PlanDocument,
  PlansDocument,
  ReadingProgressListDocument,
  TasksDocument,
} from "@/types/graphql";

export function useImportDocumentMutation() {
  return useMutation(ImportDocumentDocument, {
    refetchQueries: [PlansDocument, TasksDocument, MaterialsDocument, ReadingProgressListDocument, PlanDocument],
  });
}

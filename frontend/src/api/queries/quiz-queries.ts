/**
 * Quiz / evidence / flashcard query hooks (AD-18, epic P2-8 T1): features'
 * only consumption path. recordEvidence is THE write path from finished quiz
 * answers to node-attributed evidence (AD-5/AD-6, ADR-0001) — the scores move
 * SERVER-side, so the mutation sweeps every score-rendering surface (plans,
 * tasks, streak, evidence) on completion (AD-14: the client never recomputes).
 */
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AbandonQuizSessionDocument,
  AllEvidenceDocument,
  CreateFlashcardsDocument,
  CreateQuizSessionDocument,
  EvidenceByNodeDocument,
  FlashcardsByMaterialDocument,
  FlashcardsByPlanDocument,
  PlanDocument,
  QuizSessionDocument,
  PlansDocument,
  RateFlashcardDocument,
  RecordEvidenceDocument,
  StreakDocument,
  TaskDocument,
  TasksDocument,
} from "@/types/graphql";
import { mapEvidence, mapFlashcard, mapMistake, mapQuestion, mapQuizSession } from "../mappers";
import type { QuizSessionView } from "../views";

export function useQuizSessionQuery(sessionId: string) {
  const result = useQuery(QuizSessionDocument, { variables: { id: sessionId }, skip: !sessionId });
  const session: QuizSessionView | undefined = result.data?.quizSession ? mapQuizSession(result.data.quizSession) : undefined;
  return { data: result.data !== undefined ? session : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useNodeEvidenceQuery(nodeId: string) {
  const result = useQuery(EvidenceByNodeDocument, { variables: { nodeId }, skip: !nodeId });
  const evidence = (result.data?.evidence ?? []).map(mapEvidence);
  return { data: result.data !== undefined ? evidence : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useAllEvidenceQuery() {
  const result = useQuery(AllEvidenceDocument);
  const evidence = (result.data?.evidence ?? []).map(mapEvidence);
  return { data: result.data !== undefined ? evidence : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useCreateQuizSessionMutation() {
  // session + questions return → normalized write; nothing lists sessions.
  return useMutation(CreateQuizSessionDocument);
}

export function useRecordEvidenceMutation() {
  return useMutation(RecordEvidenceDocument, {
    // scores moved server-side: sweep every score-rendering surface (plan rollup,
    // node rows, task rings, streak). The session itself returns in the payload.
    refetchQueries: [
      PlansDocument,
      PlanDocument,
      TasksDocument,
      TaskDocument,
      AllEvidenceDocument,
      EvidenceByNodeDocument,
      StreakDocument,
    ],
  });
}

/** Exit path (FR-18 story 15): terminal `abandoned` — no evidence moves. */
export function useAbandonQuizSessionMutation() {
  return useMutation(AbandonQuizSessionDocument);
}

export function useFlashcardsByMaterialQuery(materialId: string) {
  const result = useQuery(FlashcardsByMaterialDocument, { variables: { materialId }, skip: !materialId });
  const cards = (result.data?.flashcards ?? []).map(mapFlashcard);
  return { data: result.data !== undefined ? cards : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useFlashcardsByPlanQuery(planId: string) {
  const result = useQuery(FlashcardsByPlanDocument, { variables: { planId }, skip: !planId });
  const cards = (result.data?.flashcards ?? []).map(mapFlashcard);
  return { data: result.data !== undefined ? cards : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useCreateFlashcardsMutation() {
  return useMutation(CreateFlashcardsDocument, {
    // cards return (normalized write); the deck lists gain rows via the sweep.
    refetchQueries: [FlashcardsByMaterialDocument, FlashcardsByPlanDocument],
  });
}

export function useRateFlashcardMutation() {
  // self-rating only (ADR-0001): the rating rides the returned card — evidence
  // surfaces are deliberately untouched.
  return useMutation(RateFlashcardDocument);
}

/** Question mapper re-export — mutation payloads carry raw server rows. */
export { mapQuestion };


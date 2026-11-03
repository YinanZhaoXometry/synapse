/** Quiz/evidence/flashcard Query hooks (AD-3): features' only consumption path. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EvidenceRecord } from "@/domain/entities";
import {
  abandonQuizSession,
  createQuizSession,
  getQuizSession,
  listEvidence,
  listEvidenceByNode,
  recordEvidence,
  type AnswerResult,
  type QuestionInput,
} from "./quiz-repository";
import {
  createFlashcards,
  listFlashcardsByMaterial,
  listFlashcardsByPlan,
  rateFlashcard,
  type FlashcardInput,
} from "./flashcard-repository";
import { queryKeys } from "./query-keys";

export function useQuizSessionQuery(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.quiz.session(sessionId),
    queryFn: () => getQuizSession(sessionId),
  });
}

export function useNodeEvidenceQuery(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.evidence.byNode(nodeId),
    queryFn: () => listEvidenceByNode(nodeId),
  });
}

export function useAllEvidenceQuery() {
  return useQuery({ queryKey: queryKeys.evidence.all, queryFn: listEvidence });
}

export function useCreateQuizSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planId: string | null;
      taskId: string | null;
      mode: "open" | "choice" | "mix";
      questions: QuestionInput[];
    }) => createQuizSession(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.quiz.all });
    },
  });
}

export function useRecordEvidenceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; results: AnswerResult[] }): Promise<EvidenceRecord[]> =>
      recordEvidence(input),
    onSuccess: (_evidence, input) => {
      const session = getQuizSession(input.sessionId);
      void qc.invalidateQueries({ queryKey: queryKeys.evidence.all });
      void qc.invalidateQueries({ queryKey: queryKeys.quiz.all });
      if (session?.planId) {
        void qc.invalidateQueries({ queryKey: queryKeys.plans.all });
        void qc.invalidateQueries({ queryKey: queryKeys.plans.detail(session.planId) });
      }
      if (session?.taskId) {
        // T4 (the deferred epic-5 obligation): task evidence refreshes every
        // tasks-keyed surface — Task Home's ring AND Plans Home's Study Tasks
        // section. The ["tasks"] prefix sweeps detail + node keys in one call.
        void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      }
    },
  });
}

/** Exit path (FR-18 story 15): terminal `abandoned` — no evidence moves. */
export function useAbandonQuizSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string }) => {
      abandonQuizSession(input.sessionId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.quiz.all });
    },
  });
}

export function useFlashcardsByMaterialQuery(materialId: string) {
  return useQuery({
    queryKey: queryKeys.flashcards.byMaterial(materialId),
    queryFn: () => listFlashcardsByMaterial(materialId),
  });
}

export function useFlashcardsByPlanQuery(planId: string) {
  return useQuery({
    queryKey: queryKeys.flashcards.byPlan(planId),
    queryFn: () => listFlashcardsByPlan(planId),
  });
}

export function useCreateFlashcardsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string; nodeId: string | null; cards: FlashcardInput[] }) => {
      const cards = createFlashcards(input);
      return { cards, materialId: input.materialId };
    },
    onSuccess: ({ materialId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.flashcards.all });
      void qc.invalidateQueries({ queryKey: queryKeys.materials.detail(materialId) });
    },
  });
}

export function useRateFlashcardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; difficulty: "hard" | "medium" | "easy" }) => {
      rateFlashcard(input.id, input.difficulty);
    },
    onSuccess: () => {
      // self-rating: invalidates flashcards only — evidence keys are untouched by design
      void qc.invalidateQueries({ queryKey: queryKeys.flashcards.all });
    },
  });
}

/** Quiz/evidence/flashcard Query hooks (AD-3): features' only consumption path. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EvidenceRecord } from "@/domain/entities";
import {
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
  return useQuery({ queryKey: ["quiz", sessionId], queryFn: () => getQuizSession(sessionId) });
}

export function useNodeEvidenceQuery(nodeId: string) {
  return useQuery({
    queryKey: ["evidence", "node", nodeId],
    queryFn: () => listEvidenceByNode(nodeId),
  });
}

export function useAllEvidenceQuery() {
  return useQuery({ queryKey: ["evidence"], queryFn: listEvidence });
}

function invalidateStudyKeys(qc: ReturnType<typeof useQueryClient>, planId: string | null) {
  void qc.invalidateQueries({ queryKey: ["evidence"] });
  void qc.invalidateQueries({ queryKey: ["quiz"] });
  void qc.invalidateQueries({ queryKey: ["plans", planId ?? "__none__"] });
  if (planId) void qc.invalidateQueries({ queryKey: queryKeys.plans.all });
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
      void qc.invalidateQueries({ queryKey: ["quiz"] });
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
      invalidateStudyKeys(qc, session?.planId ?? null);
    },
  });
}

export function useFlashcardsByMaterialQuery(materialId: string) {
  return useQuery({
    queryKey: ["flashcards", "material", materialId],
    queryFn: () => listFlashcardsByMaterial(materialId),
  });
}

export function useFlashcardsByPlanQuery(planId: string) {
  return useQuery({
    queryKey: ["flashcards", "plan", planId],
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
      void qc.invalidateQueries({ queryKey: ["flashcards"] });
      void qc.invalidateQueries({ queryKey: ["materials", materialId] });
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
      void qc.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });
}

/**
 * Task-flow flashcards route — /task/:id/flashcards (epic-6 T4; FR-37 parity;
 * FR-19; AD-8): a thin task-scoped composition over the flashcards feature's
 * shared FlashcardsStudyPage shell — this page owns only the task lookup and
 * the context (back targets, honest not-found copy, the task's single
 * material and its deck). No cards yet → the FlashcardLauncher inline
 * (generation from the one material); cards → the flip-first study, exactly
 * the plan twin's contract scoped to the task's single material.
 */
import { useParams } from "react-router-dom";
import { useFlashcardsByMaterialQuery, useTaskMaterialsQuery, useTaskQuery } from "@/api";
import { FlashcardsStudyPage } from "@/features/flashcards";

export default function TaskFlashcardsPage() {
  const { id } = useParams();
  const taskQuery = useTaskQuery(id ?? "");
  const materialsQuery = useTaskMaterialsQuery(id ?? "");
  // The task's deck is its single material's deck (StudyTask ||--|| Material).
  const cardsQuery = useFlashcardsByMaterialQuery(taskQuery.data?.materialId ?? "");

  if (taskQuery.loading || materialsQuery.loading || cardsQuery.loading) return null;

  const task = taskQuery.data;
  const materials = materialsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  return (
    <FlashcardsStudyPage
      context={{
        exists: !!task,
        materials,
        cards,
        homeHref: task ? `/task/${task.id}` : "/plans",
        homeLabelKey: "tasks.backToTask",
        lostHref: "/plans",
        lostLabelKey: "tasks.backToPlans",
        notFoundKey: "tasks.notFound",
      }}
    />
  );
}

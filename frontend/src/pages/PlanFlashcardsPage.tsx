/**
 * Plan-flow flashcards route — /plan/:id/flashcards (epic-6 T3, T4 refactor;
 * FR-19; AD-8): a thin plan-scoped composition over the flashcards feature's
 * shared FlashcardsStudyPage shell — this page owns only the plan lookup and
 * the context (back targets, honest not-found copy, materials, the plan's
 * persisted decks in creation order). No cards yet → the FlashcardLauncher
 * inline; cards → the flip-first study, deliberately stateless across reloads.
 */
import { useParams } from "react-router-dom";
import { useFlashcardsByPlanQuery, usePlanMaterialsQuery, usePlanQuery } from "@/api";
import { FlashcardsStudyPage } from "@/features/flashcards";

export default function PlanFlashcardsPage() {
  const { id } = useParams();
  const planQuery = usePlanQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");
  const cardsQuery = useFlashcardsByPlanQuery(id ?? "");

  if (planQuery.loading || materialsQuery.loading || cardsQuery.loading) return null;

  const plan = planQuery.data;
  const materials = materialsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  return (
    <FlashcardsStudyPage
      context={{
        exists: !!plan,
        materials,
        cards,
        homeHref: plan ? `/plan/${plan.plan.id}` : "/plans",
        homeLabelKey: "flashcards.backToPlan",
        lostHref: "/plans",
        lostLabelKey: "plans.backToPlans",
        notFoundKey: "plans.notFound",
      }}
    />
  );
}

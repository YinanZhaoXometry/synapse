/**
 * Plan-flow flashcards route — /plan/:id/flashcards (epic-6 T3; FR-19; AD-8):
 * the study page under the app layout over the plan's persisted cards — all
 * decks across the plan's materials, deck order = the repository's creation
 * order = material section order (the launcher creates per material in
 * section order). No cards yet → the FlashcardLauncher inline (the route's
 * generation entry; unknown plan id → the same honest not-found as the quiz
 * page, never a blank screen). Study state is deliberately stateless across
 * reloads (spec decision 7): ratings persist per card as they happen, so a
 * refresh only restarts the flip queue from the first card and loses nothing.
 * Delegates to features/flashcards.
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFlashcardsByPlanQuery, usePlanMaterialsQuery, usePlanQuery } from "@/data";
import { FlashcardLauncher, FlashcardStudy } from "@/features/flashcards";

export default function PlanFlashcardsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();

  const planQuery = usePlanQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");
  const cardsQuery = useFlashcardsByPlanQuery(id ?? "");

  if (planQuery.isPending || materialsQuery.isPending || cardsQuery.isPending) return null;

  const plan = planQuery.data;
  const materials = materialsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];

  if (!plan) {
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto">
        <button
          type="button"
          onClick={() => navigate("/plans")}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {t("plans.backToPlans")}
        </button>
        <p className="page-title mt-6 text-lg">{t("plans.notFound")}</p>
      </div>
    );
  }

  const backToPlan = () => navigate(`/plan/${plan.id}`);

  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="flashcards-page">
      <button
        type="button"
        onClick={backToPlan}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {t("flashcards.backToPlan")}
      </button>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border-soft bg-card p-6 md:p-8 shadow-raised" data-testid="flashcards-launch-page">
          <FlashcardLauncher
            materials={materials}
            onCreated={() => {
              // the invalidated flashcards query flips this page to the study
            }}
          />
        </div>
      ) : (
        <div className="mt-4">
          <FlashcardStudy cards={cards} materials={materials} onExit={backToPlan} />
        </div>
      )}
    </div>
  );
}

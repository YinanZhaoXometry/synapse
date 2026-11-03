/**
 * FlashcardsStudyPage (epic-6 T4): the shared flashcards ROUTE SHELL —
 * everything /plan/:id/flashcards and /task/:id/flashcards have in common,
 * extracted so the task loop behaves identically to its plan twin by
 * construction (AC: twin parity). Over the owner's persisted cards: no cards
 * yet → the FlashcardLauncher inline (the route's generation entry); cards →
 * the flip-first study (deliberately stateless across reloads — spec decision
 * 7: ratings persist per card as they happen, so a refresh only restarts the
 * flip queue and loses nothing). Unknown owner id → the honest not-found,
 * never a blank screen. The surface composes this with its own context: plan
 * lookup vs task lookup, back targets, the not-found copy.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Flashcard, Material } from "@/domain/entities";
import { FlashcardLauncher } from "./FlashcardLauncher";
import { FlashcardStudy } from "./FlashcardStudy";

/** Where the deck lives: a plan's materials or a task's single material. */
export interface FlashcardsPageContext {
  /** False → the honest not-found card (unknown plan/task id). */
  exists: boolean;
  /** The owner's materials — the deck's sources / the cards' source line. */
  materials: Material[];
  /** The owner's persisted cards (plans: all decks; tasks: the single deck). */
  cards: Flashcard[];
  /** Back from the study (Esc + the summary's exit action). */
  homeHref: string;
  homeLabelKey: string;
  /** Back when the owner itself is unknown (never a trap). */
  lostHref: string;
  lostLabelKey: string;
  /** The not-found copy — plans.notFound / tasks.notFound. */
  notFoundKey: string;
}

export function FlashcardsStudyPage({ context }: { context: FlashcardsPageContext }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const backLink = (
    <button
      type="button"
      onClick={() => navigate(context.exists ? context.homeHref : context.lostHref)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {t(context.exists ? context.homeLabelKey : context.lostLabelKey)}
    </button>
  );

  if (!context.exists) {
    return (
      <div className="p-6 md:p-8 max-w-[784px] mx-auto">
        {backLink}
        <p className="page-title mt-6 text-lg">{t(context.notFoundKey)}</p>
      </div>
    );
  }

  const backHome = () => navigate(context.homeHref);

  return (
    <div className="p-6 md:p-8 max-w-[784px] mx-auto" data-testid="flashcards-page">
      {backLink}

      {context.cards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border-soft bg-card p-6 md:p-8 shadow-raised" data-testid="flashcards-launch-page">
          <FlashcardLauncher
            materials={context.materials}
            onCreated={() => {
              // the invalidated flashcards query flips this page to the study
            }}
          />
        </div>
      ) : (
        <div className="mt-4">
          <FlashcardStudy
            cards={context.cards}
            materials={context.materials}
            backLabelKey={context.homeLabelKey}
            onExit={backHome}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The flashcards feature's public surface (epic-6 T3 + T4; AD-2, quiz/index.ts
 * precedent): the flashcard entry — FlashcardLauncher (Plan/Task Home dialogs
 * + the routes' inline generation) and FlashcardStudy (flip-first study with
 * the persisted self-rating trio) — plus the generation driver, the shared
 * route shell (FlashcardsStudyPage — /plan/:id/flashcards and
 * /task/:id/flashcards are thin context-scoped compositions, twin parity by
 * construction), and the display-shaping selectors. Dependency direction:
 * pages → features → {domain, data, ai}; nothing here writes to the scaffold
 * progress context.
 */
export { useFlashcardGeneration, type FlashcardGenerationInput, type FlashcardGenerationPhase } from "./use-flashcard-generation";
export { FlashcardLauncher, type FlashcardLauncherProps } from "./FlashcardLauncher";
export { FlashcardStudy, type FlashcardStudyProps } from "./FlashcardStudy";
export { FlashcardsStudyPage, type FlashcardsPageContext } from "./flashcards-page";
export {
  flashcardMaterialRefs,
  flashcardSourceTitle,
  ratingBreakdown,
  studyableMaterials,
  type RatingBreakdown,
} from "./display-shaping";

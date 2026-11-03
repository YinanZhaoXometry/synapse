/**
 * The flashcards feature's public surface (epic-6 T3; AD-2, quiz/index.ts
 * precedent): the plan-flow flashcard entry — FlashcardLauncher (Plan Home
 * dialog + the route's inline generation) and FlashcardStudy (flip-first
 * study with the persisted self-rating trio) — plus the generation driver and
 * the display-shaping selectors. Dependency direction: pages → features →
 * {domain, data, ai}; nothing here writes to the scaffold progress context.
 */
export { useFlashcardGeneration, type FlashcardGenerationInput, type FlashcardGenerationPhase } from "./use-flashcard-generation";
export { FlashcardLauncher, type FlashcardLauncherProps } from "./FlashcardLauncher";
export { FlashcardStudy, type FlashcardStudyProps } from "./FlashcardStudy";
export {
  flashcardMaterialRefs,
  flashcardSourceTitle,
  ratingBreakdown,
  studyableMaterials,
  type RatingBreakdown,
} from "./display-shaping";

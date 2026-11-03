/**
 * Flashcard display shaping (epic-6 T3; AD-6/9): thin, honest shaping over the
 * persisted cards and materials. No scheduling fields exist anywhere here
 * (zero SRS — FR-24 re-queue is Phase 2), and no mastery arithmetic — the
 * difficulty trio is a SELF-rating that never touches evidence (ADR-0001).
 */
import type { MaterialRef } from "@/ai/types";
import type { Flashcard, Material } from "@/domain/entities";

/**
 * Materials flashcards may generate from (FR-19 sourcing honesty): parsed with
 * at least one extracted section — a pending/failed/empty material would yield
 * zero cards, so it never unlocks the entry.
 */
export function studyableMaterials(materials: Material[]): Material[] {
  return materials.filter((m) => m.parseState === "parsed" && m.sections.length > 0);
}

/** The AI seam's MaterialRefs for a set of materials (generation input, AD-5). */
export function flashcardMaterialRefs(materials: Material[]): MaterialRef[] {
  return studyableMaterials(materials).map((m) => ({ materialId: m.id, sections: m.sections }));
}

/** A card's source material title (null when the material no longer resolves). */
export function flashcardSourceTitle(card: Flashcard, materials: Material[]): string | null {
  return materials.find((m) => m.id === card.materialId)?.title ?? null;
}

/** The summary's rating inputs: the deck's CURRENT persisted self-ratings. */
export interface RatingBreakdown {
  total: number;
  hard: number;
  medium: number;
  easy: number;
  unrated: number;
}

/** Counting only — a self-rating census, never an outcome grade (ADR-0001). */
export function ratingBreakdown(cards: Flashcard[]): RatingBreakdown {
  const counts: RatingBreakdown = { total: cards.length, hard: 0, medium: 0, easy: 0, unrated: 0 };
  for (const card of cards) {
    if (card.difficulty === null) counts.unrated += 1;
    else counts[card.difficulty] += 1;
  }
  return counts;
}

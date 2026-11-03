/**
 * Flashcard repository (AD-3). Flashcard difficulty ratings are SELF-ratings:
 * they persist on the Flashcard and never create EvidenceRecords (ADR-0001) —
 * the Mastery Score moves on quiz evidence only.
 */
import type { Flashcard } from "@/domain/entities";
import { loadDb, saveDb, updateDb } from "./store";
import { AppError } from "./errors";

export interface FlashcardInput {
  front: string;
  back: string;
}

export function createFlashcards(input: {
  materialId: string;
  nodeId: string | null;
  cards: FlashcardInput[];
}): Flashcard[] {
  const db = loadDb();
  const now = new Date().toISOString();
  const cards: Flashcard[] = input.cards.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    materialId: input.materialId,
    nodeId: input.nodeId,
    difficulty: null,
    createdAt: now,
  }));
  db.flashcards.push(...cards);
  saveDb(db);
  return cards;
}

export function rateFlashcard(id: string, difficulty: "hard" | "medium" | "easy"): void {
  updateDb((db) => {
    const card = db.flashcards.find((f) => f.id === id);
    if (!card) throw new AppError("FLASHCARD_NOT_FOUND", "errors.flashcardNotFound");
    card.difficulty = difficulty; // self-rating only — never an EvidenceRecord
  });
}

export function listFlashcardsByMaterial(materialId: string): Flashcard[] {
  return loadDb().flashcards.filter((f) => f.materialId === materialId);
}

export function listFlashcardsByPlan(planId: string): Flashcard[] {
  const db = loadDb();
  const planMaterialIds = new Set(db.materials.filter((m) => m.planId === planId).map((m) => m.id));
  return db.flashcards.filter((f) => planMaterialIds.has(f.materialId));
}

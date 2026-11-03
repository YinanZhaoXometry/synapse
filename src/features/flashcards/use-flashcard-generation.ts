/**
 * Flashcard generation driver (epic-6 T3; FR-19; AD-5): generateFlashcards
 * through the AI seam → createFlashcards persistence per material. The seam
 * returns one card per section in material order, so slicing by each
 * material's section count lines every card up with its SOURCE material
 * reference (AC: cards carry their material references). Cancel before the
 * cards land stales the in-flight start and creates NO cards — the quiz
 * driver's cancelStart contract (UX spine 「generating」 state); once the
 * persist ticks begin, cancel stops only the REMAINING materials.
 */
import { useCallback, useRef, useState } from "react";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialRef } from "@/ai/types";
import { useCreateFlashcardsMutation } from "@/data";

export type FlashcardGenerationPhase = "idle" | "generating";

export interface FlashcardGenerationInput {
  materials: MaterialRef[];
}

export function useFlashcardGeneration() {
  const [generating, setGenerating] = useState(false);
  // Monotonically increasing generation id (use-quiz-session precedent):
  // cancelStart bumps it so an in-flight start becomes stale.
  const genRef = useRef(0);
  const createCards = useCreateFlashcardsMutation();

  const start = useCallback(
    async (input: FlashcardGenerationInput): Promise<boolean> => {
      const genId = ++genRef.current;
      setGenerating(true);
      try {
        const generated = await getCompanionService().generateFlashcards({ materials: input.materials });
        // cancelled mid-generation → stale: no card is created, ever
        if (genRef.current !== genId) return false;
        let cursor = 0;
        for (const ref of input.materials) {
          const slice = generated.slice(cursor, cursor + ref.sections.length);
          cursor += ref.sections.length;
          if (slice.length > 0) {
            await createCards.mutateAsync({ materialId: ref.materialId, nodeId: null, cards: slice });
            if (genRef.current !== genId) return false; // a cancel in the persist ticks
          }
        }
        return true; // the deck exists — the caller may navigate to the study
      } finally {
        // only the CURRENT generation may clear the flag — a cancelled start
        // leaves it to cancelStart, a newer start leaves it running
        if (genRef.current === genId) setGenerating(false);
      }
    },
    [createCards],
  );

  /** Cancel allowed until the cards land (UX spine): stales the in-flight start. */
  const cancelStart = useCallback(() => {
    genRef.current += 1;
    setGenerating(false);
  }, []);

  const phase: FlashcardGenerationPhase = generating ? "generating" : "idle";
  return { phase, start, cancelStart };
}

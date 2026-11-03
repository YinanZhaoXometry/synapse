import { beforeEach, describe, expect, it } from "vitest";
import { loadDb } from "./store";
import { createFlashcards, listFlashcardsByMaterial, rateFlashcard } from "./flashcard-repository";

beforeEach(() => {
  localStorage.clear();
});

describe("flashcards (self-rating persists; never evidence — ADR-0001)", () => {
  it("creates a deck for a material and lists it back", () => {
    const cards = createFlashcards({
      materialId: "m-1",
      nodeId: "node-a",
      cards: [
        { front: "集成测试是？", back: "组件间交互的验证" },
        { front: "What gates system testing?", back: "Interface contracts" },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(listFlashcardsByMaterial("m-1").map((c) => c.front)).toEqual([
      "集成测试是？",
      "What gates system testing?",
    ]);
  });

  it("rating a card persists the difficulty and creates NO EvidenceRecord", () => {
    const [card] = createFlashcards({
      materialId: "m-1",
      nodeId: "node-a",
      cards: [{ front: "f", back: "b" }],
    });
    expect(loadDb().evidence).toHaveLength(0);

    rateFlashcard(card.id, "hard");

    expect(loadDb().flashcards[0].difficulty).toBe("hard");
    expect(loadDb().evidence).toHaveLength(0); // self-rating ≠ evidence, ever
  });
});

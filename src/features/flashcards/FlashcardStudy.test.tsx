import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createFlashcards, createPlan, listEvidence, loadDb, rateFlashcard, registerMaterial } from "@/data";
import type { Flashcard } from "@/domain/entities";
import { FlashcardStudy } from "./FlashcardStudy";

/**
 * FlashcardStudy observable states (T3; spec testing seam 3): NFR-8
 * front-before-reveal asserted in render — the back is ABSENT from the DOM
 * until the flip, and a revisit shows the front first again (reveal is an
 * action, not a state); the difficulty trio persists per card through the
 * real rating mutation and produces ZERO EvidenceRecords (the evidence and
 * mistake stores are byte-identical after a fully-rated session — ADR-0001);
 * the keyboard map (Space flip, ←→ navigate, Esc exit); the end-of-queue
 * summary with the ratings breakdown, back-to-plan, and 再学一轮 restarting
 * the same queue; and the zero-SRS absence check — no scheduling field ever
 * appears on a persisted card. Expected copy reads the copy deck directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

function seedDeck(): { cards: Flashcard[]; material: ReturnType<typeof registerMaterial>["material"] } {
  const { plan } = createPlan({ topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }] });
  const { material } = registerMaterial({
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: plan.id,
    taskId: null,
    sections: [
      { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
      { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
      { id: "sec-3", title: "验收标准", text: "验收标准来自规约。" },
    ],
    parseState: "parsed",
  });
  // Three cards with assertion-friendly faces (section order = creation order).
  const cards = createFlashcards({
    materialId: material.id,
    nodeId: null,
    cards: [
      { front: "front-one", back: "back-one" },
      { front: "front-two", back: "back-two" },
      { front: "front-three", back: "back-three" },
    ],
  });
  return { cards, material };
}

function renderStudy(
  cards: Flashcard[],
  materials: ReturnType<typeof registerMaterial>["material"][],
): { onExit: ReturnType<typeof vi.fn> } {
  const onExit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <FlashcardStudy cards={cards} materials={materials} onExit={onExit} />
      </QueryClientProvider>
    </LanguageProvider>,
  );
  return { onExit };
}

beforeEach(() => {
  localStorage.clear();
});

describe("FlashcardStudy — NFR-8 front-before-reveal (render-enforced)", () => {
  it("the front renders first and the back is ABSENT from the DOM until the flip", () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-one");
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument();
    expect(screen.queryByText("back-one")).not.toBeInTheDocument(); // nothing to leak
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 3 }));
  });

  it("Space flips; ←→ navigate and the next card shows its FRONT again (back absent until flipped)", () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("flashcards-back")).toHaveTextContent("back-one"); // revealed by the flip

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 2, n: 3 }));
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-two");
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument(); // front-first again
    expect(screen.queryByText("back-two")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flashcards-card")); // click flips too
    expect(screen.getByTestId("flashcards-back")).toHaveTextContent("back-two");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-one");
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument();
    // a rated card still shows the FRONT first — reveal is an action, not a state
  });
});

describe("FlashcardStudy — the difficulty trio persists (self-rating only, ADR-0001)", () => {
  it("rating 难/中/易 persists through the rating mutation and advances; revisiting shows the saved rating", async () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);

    fireEvent.keyDown(window, { key: " " }); // flip card 1
    fireEvent.click(screen.getByTestId("flashcards-rate-easy"));
    expect(await screen.findByTestId("flashcards-front")).toHaveTextContent("front-two"); // advanced
    expect(loadDb().flashcards.find((c) => c.id === cards[0].id)?.difficulty).toBe("easy"); // persisted

    fireEvent.keyDown(window, { key: "ArrowLeft" }); // free navigation back
    fireEvent.keyDown(window, { key: " " }); // …flip again
    expect(screen.getByTestId("flashcards-rate-easy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flashcards-saved-rating")).toHaveTextContent(zh("flashcards.study.savedRating"));

    // re-rating is allowed — latest wins, still self-rating only
    fireEvent.click(screen.getByTestId("flashcards-rate-hard"));
    await waitFor(() => expect(loadDb().flashcards.find((c) => c.id === cards[0].id)?.difficulty).toBe("hard"));
  });

  it("a PRE-RATED card shows its persisted rating on revisit (reload keeps prior ratings)", () => {
    const { cards, material } = seedDeck();
    rateFlashcard(cards[1].id, "medium"); // as a previous session left it
    // the way the page sees them: fresh reads from the store (loadDb deep-copies)
    const persisted = loadDb().flashcards.filter((c) => c.materialId === material.id);
    renderStudy(persisted, [material]);

    fireEvent.keyDown(window, { key: "ArrowRight" }); // to card 2 — front first
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-two");
    expect(screen.queryByTestId("flashcards-saved-rating")).not.toBeInTheDocument(); // nothing revealed yet
    fireEvent.keyDown(window, { key: " " }); // flip → the saved rating shows
    expect(screen.getByTestId("flashcards-rate-medium")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flashcards-saved-rating")).toBeInTheDocument();
  });

  it("a fully rated session leaves the evidence and mistake stores byte-identical (zero EvidenceRecords)", async () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);
    const evidenceBefore = JSON.stringify(loadDb().evidence);
    const mistakesBefore = JSON.stringify(loadDb().mistakes);

    // rate all three through the UI
    for (const [i, difficulty] of ["flashcards-rate-hard", "flashcards-rate-medium", "flashcards-rate-easy"].entries()) {
      fireEvent.keyDown(window, { key: " " }); // flip the current card
      fireEvent.click(screen.getByTestId(difficulty));
      if (i < 2) {
        expect(await screen.findByTestId("flashcards-front")).toHaveTextContent(`front-${["one", "two", "three"][i + 1]}`);
      }
    }
    expect(await screen.findByTestId("flashcards-summary")).toBeInTheDocument();

    expect(JSON.stringify(loadDb().evidence)).toBe(evidenceBefore); // unchanged
    expect(JSON.stringify(loadDb().mistakes)).toBe(mistakesBefore); // unchanged
    expect(listEvidence()).toHaveLength(0);
    // zero SRS (absence): no scheduling field ever appears — the persisted card
    // shape is exactly the entity's, no due/interval/requeue bookkeeping
    const expectedKeys = Object.keys(cards[0]).sort().join(",");
    for (const card of loadDb().flashcards) {
      expect(Object.keys(card).sort().join(",")).toBe(expectedKeys);
      expect(Object.keys(card).some((k) => /due|interval|schedul|queue|reps/i.test(k))).toBe(false);
    }
  });
});

describe("FlashcardStudy — keyboard map and the end-of-queue summary", () => {
  it("Esc exits to the plan immediately (safe: ratings already persist)", () => {
    const { cards, material } = seedDeck();
    const { onExit } = renderStudy(cards, [material]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("reaching the end shows the summary with the ratings breakdown, back-to-plan, and 再学一轮 restarting the queue", async () => {
    const { cards, material } = seedDeck();
    const { onExit } = renderStudy(cards, [material]);

    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-hard"));
    await screen.findByText("front-two"); // the persist-then-advance landed
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium"));
    await screen.findByText("front-three");
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-easy"));
    const summary = await screen.findByTestId("flashcards-summary");
    expect(summary.textContent).toContain(zhVars("flashcards.summary.breakdown", { n: 3, h: 1, m: 1, e: 1 }));
    expect(summary.textContent).toContain(zh("flashcards.summary.statelessNote")); // the honest stateless note
    // fully rated → no unrated line (the unrated count only renders when > 0)
    expect(summary.textContent).not.toContain(zh("flashcards.summary.unrated").split(" ")[0]);

    fireEvent.click(screen.getByTestId("flashcards-back-to-plan"));
    expect(onExit).toHaveBeenCalledTimes(1); // the back-to-plan path
  });

  it("再学一轮 restarts the SAME queue at card 1 front-first (not regeneration — no new cards)", async () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-hard"));
    await screen.findByText("front-two"); // the persist-then-advance landed
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium"));
    await screen.findByText("front-three");
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-easy"));
    await screen.findByTestId("flashcards-summary");

    fireEvent.click(screen.getByTestId("flashcards-again"));
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 3 }));
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-one");
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument(); // front-first again
    expect(loadDb().flashcards).toHaveLength(3); // restart, never regeneration
  });

  it("navigating past the end without rating everything: the summary counts the unrated honestly", async () => {
    const { cards, material } = seedDeck();
    renderStudy(cards, [material]);
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-easy")); // card 1 only
    await screen.findByText("front-two"); // the persist-then-advance landed
    fireEvent.keyDown(window, { key: "ArrowRight" }); // card 2
    fireEvent.keyDown(window, { key: "ArrowRight" }); // card 3
    fireEvent.keyDown(window, { key: "ArrowRight" }); // past the end → summary

    const summary = await screen.findByTestId("flashcards-summary");
    expect(summary.textContent).toContain(zhVars("flashcards.summary.breakdown", { n: 3, h: 0, m: 0, e: 1 }));
    expect(summary.textContent).toContain(zhVars("flashcards.summary.unrated", { u: 2 }));
  });
});

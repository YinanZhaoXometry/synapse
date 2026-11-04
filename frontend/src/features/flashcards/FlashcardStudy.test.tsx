import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateFlashcardDocument } from "@/types/graphql";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { Flashcard, Material } from "@/domain/entities";
import { FlashcardStudy } from "./FlashcardStudy";

/**
 * FlashcardStudy observable states (T3; spec testing seam 3 over MockedProvider,
 * the cutover's Apollo test seam): NFR-8 front-before-reveal asserted in render
 * — the back is ABSENT from the DOM until the flip, and a revisit shows the
 * front first again (reveal is an action, not a state); the difficulty trio
 * persists per card through the rating mutation (captured on the mock's
 * variables — the persistence contract) and reaches the summary ONLY through
 * those mutations succeeding (an unmatched write would reject, keep the card
 * flipped, and never land the summary — so reaching it proves nothing else
 * fired; zero EvidenceRecords stays structural: ratings never carry evidence,
 * ADR-0001); the keyboard map (Space flip, ←→ navigate, Esc exit); the
 * end-of-queue summary with the ratings breakdown, back-to-plan, and 再学一轮
 * restarting the same queue. Expected copy reads the copy deck directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const MATERIAL_ID = "m-1";

const material: Material = {
  id: MATERIAL_ID,
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 64,
  planId: null,
  taskId: null,
  parseState: "parsed",
  sections: [
    { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
    { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
    { id: "sec-3", title: "验收标准", text: "验收标准来自规约。" },
  ],
  createdAt: "2026-11-01T09:00:00Z",
};

/** Three cards with assertion-friendly faces (section order = creation order). */
const deck = (ratings: Record<string, Flashcard["difficulty"]> = {}): Flashcard[] =>
  ["one", "two", "three"].map((n, i) => ({
    id: `c-${n}`,
    materialId: MATERIAL_ID,
    nodeId: null,
    front: `front-${n}`,
    back: `back-${n}`,
    difficulty: ratings[`c-${n}`] ?? null,
    createdAt: "2026-11-01T09:00:00Z",
  }));

// The rating capture: every self-rating the study fires lands here, in order.
let rated: Array<{ id: string; difficulty: string }> = [];

function rateMock() {
  return {
    request: {
      query: RateFlashcardDocument,
      variables: (vars) => {
        rated.push({ id: vars.input.id, difficulty: vars.input.difficulty });
        return true;
      },
    },
    result: (vars) => ({
      data: {
        __typename: "Mutation",
        rateFlashcard: {
          __typename: "RateFlashcardPayload",
          flashcard: { __typename: "Flashcard", id: vars.input.id, difficulty: vars.input.difficulty },
        },
      },
    }),
    maxUsageCount: 10,
  };
}

function renderStudy(cards: Flashcard[]): { onExit: ReturnType<typeof vi.fn> } {
  const onExit = vi.fn();
  render(
    <LanguageProvider>
      <MockedProvider mocks={[rateMock()]}>
        <FlashcardStudy cards={cards} materials={[material]} onExit={onExit} />
      </MockedProvider>
    </LanguageProvider>,
  );
  return { onExit };
}

beforeEach(() => {
  rated = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FlashcardStudy — NFR-8 front-before-reveal (render-enforced)", () => {
  it("the front renders first and the back is ABSENT from the DOM until the flip", () => {
    renderStudy(deck());
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-one");
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument();
    expect(screen.queryByText("back-one")).not.toBeInTheDocument(); // nothing to leak
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 3 }));
  });

  it("Space flips; ←→ navigate and the next card shows its FRONT again (back absent until flipped)", () => {
    renderStudy(deck());

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

describe("FlashcardStudy — the difficulty trio persists through the rating mutation (self-rating only, ADR-0001)", () => {
  it("rating 难/中/易 persists through the rating mutation and advances; revisiting shows the saved rating", async () => {
    renderStudy(deck());

    fireEvent.keyDown(window, { key: " " }); // flip card 1
    fireEvent.click(screen.getByTestId("flashcards-rate-easy"));
    // persist-then-advance: the next card's front is the arrival signal
    expect(await screen.findByText("front-two")).toBeInTheDocument();
    expect(rated).toEqual([{ id: "c-one", difficulty: "easy" }]); // the write left the client

    fireEvent.keyDown(window, { key: "ArrowLeft" }); // free navigation back
    fireEvent.keyDown(window, { key: " " }); // …flip again
    expect(screen.getByTestId("flashcards-rate-easy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flashcards-saved-rating")).toHaveTextContent(zh("flashcards.study.savedRating"));

    // re-rating is allowed — latest wins, still self-rating only
    fireEvent.click(screen.getByTestId("flashcards-rate-hard"));
    await waitFor(() =>
      expect(rated).toEqual([
        { id: "c-one", difficulty: "easy" },
        { id: "c-one", difficulty: "hard" },
      ]),
    );
  });

  it("a PRE-RATED card shows its persisted rating on revisit (reload keeps prior ratings)", () => {
    renderStudy(deck({ "c-two": "medium" })); // as a previous session left it

    fireEvent.keyDown(window, { key: "ArrowRight" }); // to card 2 — front first
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("front-two");
    expect(screen.queryByTestId("flashcards-saved-rating")).not.toBeInTheDocument(); // nothing revealed yet
    fireEvent.keyDown(window, { key: " " }); // flip → the saved rating shows
    expect(screen.getByTestId("flashcards-rate-medium")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flashcards-saved-rating")).toBeInTheDocument();
  });

  it("a fully rated session produces exactly the three rating writes and nothing else", async () => {
    renderStudy(deck());

    // rate all three through the UI
    for (const [i, difficulty] of ["flashcards-rate-hard", "flashcards-rate-medium", "flashcards-rate-easy"].entries()) {
      fireEvent.keyDown(window, { key: " " }); // flip the current card
      fireEvent.click(screen.getByTestId(difficulty));
      if (i < 2) {
        expect(await screen.findByText(`front-${["one", "two", "three"][i + 1]}`)).toBeInTheDocument();
      }
    }
    expect(await screen.findByTestId("flashcards-summary")).toBeInTheDocument();

    // the ONLY writes were the three self-ratings, in queue order — a rating
    // never creates evidence (ADR-0001), and any other mutation attempt would
    // have gone unmatched, rejected, and kept the queue from reaching the summary
    expect(rated).toEqual([
      { id: "c-one", difficulty: "hard" },
      { id: "c-two", difficulty: "medium" },
      { id: "c-three", difficulty: "easy" },
    ]);
  });
});

describe("FlashcardStudy — keyboard map and the end-of-queue summary", () => {
  it("Esc exits to the plan immediately (safe: ratings already persist)", () => {
    const { onExit } = renderStudy(deck());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("reaching the end shows the summary with the ratings breakdown, back-to-plan, and 再学一轮 restarting the queue", async () => {
    const { onExit } = renderStudy(deck());

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
    renderStudy(deck());
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
    expect(rated).toHaveLength(3); // restart, never regeneration — no new writes beyond the round's three
  });

  it("navigating past the end without rating everything: the summary counts the unrated honestly", async () => {
    renderStudy(deck());
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import PlanHomePage from "@/features/plans/PlanHomePage";
import { createFlashcards, createPlan, loadDb, rateFlashcard, registerMaterial } from "@/data";
import type { MaterialSection } from "@/domain/entities";
import PlanFlashcardsPage from "./PlanFlashcardsPage";

/**
 * PlanFlashcardsPage observable states (T3; spec testing seam 3): the honest
 * not-found (unknown plan id), the route's inline FlashcardLauncher when the
 * plan has no cards yet, the study over the plan's persisted deck in CREATION
 * order (= material section order, AD-6), the Esc exit back to the plan, the
 * reload contract (ratings persist per card — a fresh mount shows the saved
 * rating; the queue restarts from the first card), and the Plan Home tile's
 * two behaviors (cards exist → straight to the study as 「继续学习」; none →
 * the FlashcardLauncher dialog). Expected copy reads the copy deck directly.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const sectionsA: MaterialSection[] = [
  { id: "a-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
  { id: "a-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
];

function PlanLanding() {
  return <p data-testid="plan-landing" />;
}
function FlashcardsLanding() {
  return <p data-testid="flashcards-landing" />;
}

function renderAt(path: string, surface: "flashcards" | "planHome" = "flashcards") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LanguageProvider>
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Toaster />
            <Routes>
              {surface === "flashcards" ? (
                <>
                  <Route path="/plan/:id/flashcards" element={<PlanFlashcardsPage />} />
                  <Route path="/plan/:id" element={<PlanLanding />} />
                </>
              ) : (
                <>
                  {/* the tile test: Plan Home renders; its navigation lands on the stub */}
                  <Route path="/plan/:id" element={<PlanHomePage />} />
                  <Route path="/plan/:id/flashcards" element={<FlashcardsLanding />} />
                </>
              )}
              <Route path="/plans" element={<p data-testid="plans-landing" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </LanguageProvider>,
  );
}

/** Seed a plan with one parsed material and no cards. */
function seedPlan() {
  const { plan } = createPlan({ topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }] });
  const { material } = registerMaterial({
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: plan.id,
    taskId: null,
    sections: sectionsA,
    parseState: "parsed",
  });
  return { plan, material };
}

/** Seed a second deck on the same plan to prove the cross-material order. */
function seedSecondDeck(planId: string) {
  const { material } = registerMaterial({
    title: "讲义二.md",
    kind: "markdown",
    sizeBytes: 64,
    planId,
    taskId: null,
    sections: [{ id: "b-1", title: "测试金字塔", text: "测试金字塔分层排序自动化测试。" }],
    parseState: "parsed",
  });
  createFlashcards({
    materialId: material.id,
    nodeId: null,
    cards: [{ front: "deck-two-card", back: "deck-two-back" }],
  });
  return material;
}

beforeEach(() => {
  localStorage.clear();
});

describe("PlanFlashcardsPage — honest routes (FR-19; AD-8)", () => {
  it("unknown plan id: the shared not-found with the way back, never a blank screen", async () => {
    renderAt("/plan/no-such-plan/flashcards");
    expect(await screen.findByText(zh("plans.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("plans.backToPlans") })).toBeInTheDocument();
  });

  it("no cards yet: the FlashcardLauncher renders inline on the route", async () => {
    const { plan, material } = seedPlan();
    renderAt(`/plan/${plan.id}/flashcards`);
    expect(await screen.findByTestId("flashcards-launch-page")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId(`flashcards-source-${material.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });
});

describe("PlanFlashcardsPage — the study over the persisted deck (deck order; reload contract)", () => {
  it("deck order = creation order = material section order across ALL the plan's materials", async () => {
    const { plan, material } = seedPlan();
    createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [
        { front: "deck-one-a", back: "back-one-a" },
        { front: "deck-one-b", back: "back-one-b" },
      ],
    });
    seedSecondDeck(plan.id); // one more card, second material

    renderAt(`/plan/${plan.id}/flashcards`);
    expect(await screen.findByTestId("flashcards-study")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-a");
    expect(screen.getByTestId("flashcards-progress")).toHaveTextContent(zhVars("flashcards.study.progress", { i: 1, n: 3 }));

    fireEvent.keyDown(window, { key: " " }); // flip
    expect(screen.getByTestId("flashcards-back")).toHaveTextContent("back-one-a");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-b");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-two-card"); // the second material's deck follows
    expect(screen.getByTestId("flashcards-back")).toHaveTextContent("deck-two-back");
  });

  it("Esc exits to the plan; ratings given so far stay persisted", async () => {
    const { plan, material } = seedPlan();
    const [card] = createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [
        { front: "deck-one-a", back: "back-one-a" },
        { front: "deck-one-b", back: "back-one-b" },
      ],
    });
    renderAt(`/plan/${plan.id}/flashcards`);
    await screen.findByTestId("flashcards-study");

    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-hard")); // card 1 rated → card 2
    expect(await screen.findByTestId("flashcards-front")).toHaveTextContent("deck-one-b");
    fireEvent.keyDown(window, { key: "Escape" }); // mid-deck — exit is immediate and safe

    expect(await screen.findByTestId("plan-landing")).toBeInTheDocument(); // back to the plan
    expect(loadDb().flashcards.find((c) => c.id === card.id)?.difficulty).toBe("hard"); // nothing lost
  });

  it("a reload keeps prior ratings: a fresh mount restarts at card 1 and the saved rating shows after the flip", async () => {
    const { plan, material } = seedPlan();
    const cards = createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [
        { front: "deck-one-a", back: "back-one-a" },
        { front: "deck-one-b", back: "back-one-b" },
      ],
    });
    rateFlashcard(cards[0].id, "easy"); // as the previous session left it

    // first mount: rate card 2 through the real mutation, then "reload"
    const { unmount } = renderAt(`/plan/${plan.id}/flashcards`);
    await screen.findByTestId("flashcards-study");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium"));
    await waitFor(() => expect(loadDb().flashcards.find((c) => c.id === cards[1].id)?.difficulty).toBe("medium"));
    unmount();

    renderAt(`/plan/${plan.id}/flashcards`); // the fresh mount — the queue restarts
    await screen.findByTestId("flashcards-study");
    expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-a"); // from the first card again
    expect(screen.queryByTestId("flashcards-back")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " }); // card 1's persisted rating shows
    expect(screen.getByTestId("flashcards-rate-easy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flashcards-saved-rating")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" }); // card 2's rating survived the reload too
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("flashcards-rate-medium")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Plan Home flashcards tile (T3 entry)", () => {
  it("cards exist: the tile reads 「继续学习」 and goes straight to the study", async () => {
    const { plan, material } = seedPlan();
    createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [{ front: "deck-one-a", back: "back-one-a" }],
    });
    renderAt(`/plan/${plan.id}`, "planHome");
    const tile = await screen.findByRole("button", { name: new RegExp(zh("flashcards.tileContinue")) });
    expect(tile.textContent).toContain(zhVars("flashcards.tileContinueDesc", { n: 1 }));
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-landing")).toBeInTheDocument();
  });

  it("no cards yet: the tile opens the FlashcardLauncher dialog (generation entry)", async () => {
    const { plan } = seedPlan();
    renderAt(`/plan/${plan.id}`, "planHome");
    const tile = await screen.findByRole("button", { name: new RegExp(zh("plans.quickFlashcards")) });
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument(); // inside the dialog
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });
});

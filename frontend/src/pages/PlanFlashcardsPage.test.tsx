import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import PlanHomePage from "@/features/plans/PlanHomePage";
import {
  AllEvidenceDocument,
  FlashcardsByPlanDocument,
  MaterialsDocument,
  PlanDocument,
  RateFlashcardDocument,
  ReadingProgressDocument,
  StreakDocument,
} from "@/types/graphql";
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
 *
 * Apollo cutover (epic P2-8): the deck rides the FlashcardsByPlan query and
 * ratings persist through the RateFlashcard mutation — its mock echoes the
 * request and CAPTURES it, so the old store assertions read the captured
 * mutations; the "reload" mounts fresh fixtures carrying the persisted
 * ratings the way the api would return them.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const sectionsA = [
  { __typename: "MaterialSection", id: "a-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
  { __typename: "MaterialSection", id: "a-2", title: "需求工程", text: "需求工程把用户需要转化为规约。" },
];
const sectionsB = [{ __typename: "MaterialSection", id: "b-1", title: "测试金字塔", text: "测试金字塔分层排序自动化测试。" }];

const NOW = "2026-11-01T00:00:00Z";
const PLAN_ID = "plan-1";

const planDetail = () => ({
  __typename: "StudyPlan",
  id: PLAN_ID,
  topic: "软工备考",
  goal: null,
  createdAt: NOW,
  masteryScore: "0",
  visibility: "private",
  nodes: [
    { __typename: "KnowledgeNode", id: "n-1", planId: PLAN_ID, taskId: null, stage: "核心", title: "软件测试", order: 0, masteryScore: "0", state: "uncovered", createdAt: NOW },
  ],
  materials: [
    {
      __typename: "Material",
      id: "m-1",
      title: "复习讲义.md",
      kind: "markdown",
      sizeBytes: 64,
      planId: PLAN_ID,
      taskId: null,
      parseState: "parsed",
      parseFailureReason: null,
      createdAt: NOW,
      downloadUrl: "https://storage.example/m-1",
    },
  ],
});

const materialFull = (id: string, title: string, sections: Array<Record<string, unknown>>) => ({
  __typename: "Material",
  id,
  title,
  kind: "markdown",
  sizeBytes: 64,
  planId: PLAN_ID,
  taskId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: NOW,
  downloadUrl: `https://storage.example/${id}`,
  sections,
});

const cardFixture = (id: string, materialId: string, front: string, back: string, difficulty: string | null = null) => ({
  __typename: "Flashcard",
  id,
  materialId,
  nodeId: null,
  front,
  back,
  difficulty,
  createdAt: NOW,
});

/** Every RateFlashcard the study fires: captured for the old store assertions. */
let ratedCards: Array<{ id: string; difficulty: string }>;

const rateFlashcardMock = {
  request: {
    query: RateFlashcardDocument,
    variables: (variables: Record<string, unknown>) => !!(variables.input as { id?: string } | undefined)?.id,
  },
  result: (variables: Record<string, unknown>) => {
    const input = variables.input as { id: string; difficulty: string };
    ratedCards.push(input);
    return { data: { rateFlashcard: { __typename: "RateFlashcardPayload", flashcard: { __typename: "Flashcard", id: input.id, difficulty: input.difficulty } } } };
  },
  maxUsageCount: 10,
};

interface ScenarioMocks {
  plan?: Record<string, unknown> | null;
  planMaterials?: Array<Record<string, unknown>>;
  cards?: Array<Record<string, unknown>>;
  withPlanHome?: boolean;
}

/** The mock set for one scenario; refetch-safe usage counts. */
function mocksFor(scenario: ScenarioMocks) {
  const { plan = planDetail(), planMaterials = [], cards = [], withPlanHome = false } = scenario;
  const mocks: Array<Record<string, unknown>> = [
    { request: { query: PlanDocument, variables: { id: PLAN_ID } }, result: { data: { plan } }, maxUsageCount: 6 },
    {
      request: { query: FlashcardsByPlanDocument, variables: { planId: PLAN_ID } },
      result: { data: { flashcards: cards } },
      maxUsageCount: 3,
    },
    rateFlashcardMock,
  ];
  if (planMaterials.length > 0 || withPlanHome) {
    mocks.push({
      request: { query: MaterialsDocument, variables: { planId: PLAN_ID } },
      result: { data: { materials: planMaterials } },
      maxUsageCount: 3,
    });
  }
  if (withPlanHome) {
    mocks.push(
      { request: { query: AllEvidenceDocument, variables: {} }, result: { data: { evidence: [] } }, maxUsageCount: 3 },
      { request: { query: StreakDocument, variables: {} }, result: { data: { streak: 0 } }, maxUsageCount: 3 },
      {
        request: { query: ReadingProgressDocument, variables: { materialId: "m-1" } },
        result: { data: { readingProgress: null } },
        maxUsageCount: 3,
      },
    );
  }
  return mocks;
}

function PlanLanding() {
  return <p data-testid="plan-landing" />;
}
function FlashcardsLanding() {
  return <p data-testid="flashcards-landing" />;
}

function renderAt(mocks: Array<Record<string, unknown>>, path: string, surface: "flashcards" | "planHome" = "flashcards") {
  return render(
    <LanguageProvider>
      <TooltipProvider>
        <MockedProvider mocks={mocks as never}>
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
            </Routes>
          </MemoryRouter>
        </MockedProvider>
      </TooltipProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  ratedCards = [];
});

describe("PlanFlashcardsPage — honest routes (FR-19; AD-8)", () => {
  it("unknown plan id: the shared not-found with the way back, never a blank screen", async () => {
    renderAt(mocksFor({ plan: null }), "/plan/no-such-plan/flashcards");
    expect(await screen.findByText(zh("plans.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("plans.backToPlans") })).toBeInTheDocument();
  });

  it("no cards yet: the FlashcardLauncher renders inline on the route", async () => {
    renderAt(
      mocksFor({ planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)] }),
      `/plan/${PLAN_ID}/flashcards`,
    );
    expect(await screen.findByTestId("flashcards-launch-page")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-source-m-1")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });
});

describe("PlanFlashcardsPage — the study over the persisted deck (deck order; reload contract)", () => {
  it("deck order = creation order = material section order across ALL the plan's materials", async () => {
    renderAt(
      mocksFor({
        planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA), materialFull("m-2", "讲义二.md", sectionsB)],
        cards: [
          cardFixture("fc-1", "m-1", "deck-one-a", "back-one-a"),
          cardFixture("fc-2", "m-1", "deck-one-b", "back-one-b"),
          cardFixture("fc-3", "m-2", "deck-two-card", "deck-two-back"),
        ],
      }),
      `/plan/${PLAN_ID}/flashcards`,
    );
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
    renderAt(
      mocksFor({
        planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)],
        cards: [cardFixture("fc-1", "m-1", "deck-one-a", "back-one-a"), cardFixture("fc-2", "m-1", "deck-one-b", "back-one-b")],
      }),
      `/plan/${PLAN_ID}/flashcards`,
    );
    await screen.findByTestId("flashcards-study");

    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-hard")); // card 1 rated → card 2 (the mutation's
    // round trip advances the queue — wait for the new front, never the old one)
    await waitFor(() => expect(screen.getByTestId("flashcards-front")).toHaveTextContent("deck-one-b"));
    await waitFor(() => expect(ratedCards).toEqual([{ id: "fc-1", difficulty: "hard" }])); // persisted through the mutation
    fireEvent.keyDown(window, { key: "Escape" }); // mid-deck — exit is immediate and safe

    expect(await screen.findByTestId("plan-landing")).toBeInTheDocument(); // back to the plan
    expect(ratedCards).toEqual([{ id: "fc-1", difficulty: "hard" }]); // nothing lost
  });

  it("a reload keeps prior ratings: a fresh mount restarts at card 1 and the saved rating shows after the flip", async () => {
    // the deck as the previous session left it: card 1 rated easy, card 2 unrated
    const firstMountCards = [cardFixture("fc-1", "m-1", "deck-one-a", "back-one-a", "easy"), cardFixture("fc-2", "m-1", "deck-one-b", "back-one-b")];
    const firstMocks = mocksFor({
      planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)],
      cards: firstMountCards,
    });
    const { unmount } = renderAt(firstMocks, `/plan/${PLAN_ID}/flashcards`);
    await screen.findByTestId("flashcards-study");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    fireEvent.click(screen.getByTestId("flashcards-rate-medium"));
    await waitFor(() => expect(ratedCards).toEqual([{ id: "fc-2", difficulty: "medium" }])); // through the real mutation
    unmount();

    // the fresh mount — the api returns the persisted ratings; the queue restarts
    renderAt(
      mocksFor({
        planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)],
        cards: [
          cardFixture("fc-1", "m-1", "deck-one-a", "back-one-a", "easy"),
          cardFixture("fc-2", "m-1", "deck-one-b", "back-one-b", "medium"),
        ],
      }),
      `/plan/${PLAN_ID}/flashcards`,
    );
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
    renderAt(
      mocksFor({
        planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)],
        cards: [cardFixture("fc-1", "m-1", "deck-one-a", "back-one-a")],
        withPlanHome: true,
      }),
      `/plan/${PLAN_ID}`,
      "planHome",
    );
    const tile = await screen.findByRole("button", { name: new RegExp(zh("flashcards.tileContinue")) });
    expect(tile.textContent).toContain(zhVars("flashcards.tileContinueDesc", { n: 1 }));
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-landing")).toBeInTheDocument();
  });

  it("no cards yet: the tile opens the FlashcardLauncher (Plan Home reads FULL materials — P2 fix)", async () => {
    renderAt(
      mocksFor({ planMaterials: [materialFull("m-1", "复习讲义.md", sectionsA)], cards: [], withPlanHome: true }),
      `/plan/${PLAN_ID}`,
      "planHome",
    );
    const tile = await screen.findByRole("button", { name: new RegExp(zh("plans.quickFlashcards")) });
    // FIXED after the page-tests rewrite: PlanHome sources the launch path from
    // the full materials query (summaries carry no sections, which gated the
    // FR-18 gate shut forever). A parsed material with sections now opens the
    // generation dialog — the deckless-plan generation entry works again.
    expect(tile).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument();
  });
});

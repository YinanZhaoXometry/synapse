import { MockedProvider } from "@apollo/client/testing/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  AllEvidenceDocument,
  FlashcardsByPlanDocument,
  MaterialsDocument,
  PlanDocument,
  PlanMistakeEntriesDocument,
  PlanNodeMappingsDocument,
  PlanNotesDocument,
  StreakDocument,
} from "@/types/graphql";
import PlanHomePage from "./PlanHomePage";

/**
 * Plan Home's nodes-zone view flip (epic-16 T3): the ROADMAP GRAPH is the
 * default view — the canvas renders on arrival without a click, the Graph
 * tab carries aria-selected (shadcn Tabs), and the stage-grouped List stays one click away
 * (the flip swaps only the nodes zone; existing e2e assertions read node
 * titles "wherever they render" and survive the flip).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const NOW = "2026-11-05T00:00:00Z";

const USAGE = 6;

const node = (id: string, stage: string, order: number) => ({
  __typename: "KnowledgeNode",
  id,
  planId: "plan-1",
  taskId: null,
  stage,
  title: `节点 ${order}`,
  description: null,
  optional: false,
  order,
  masteryScore: "0",
  state: "uncovered",
  createdAt: NOW,
});

const planDetail = {
  __typename: "StudyPlan",
  id: "plan-1",
  topic: "系统设计面试",
  goal: null,
  createdAt: NOW,
  masteryScore: "0",
  visibility: "private",
  forkedFromTopic: null,
  edges: [],
  nodes: [node("n-1", "基础", 0), node("n-2", "实践", 1)],
  materials: [],
};

/** Every read Plan Home issues on a materials-empty plan. */
const mocks: MockedResponse[] = [
  { request: { query: PlanDocument, variables: { id: "plan-1" } }, result: { data: { plan: planDetail } }, maxUsageCount: USAGE },
  { request: { query: MaterialsDocument, variables: { planId: "plan-1" } }, result: { data: { materials: [] } }, maxUsageCount: USAGE },
  { request: { query: AllEvidenceDocument, variables: {} }, result: { data: { evidence: [] } }, maxUsageCount: USAGE },
  { request: { query: FlashcardsByPlanDocument, variables: { planId: "plan-1" } }, result: { data: { flashcards: [] } }, maxUsageCount: USAGE },
  { request: { query: StreakDocument, variables: {} }, result: { data: { streak: 0 } }, maxUsageCount: USAGE },
  { request: { query: PlanNodeMappingsDocument, variables: { planId: "plan-1" } }, result: { data: { planNodeMappings: [] } }, maxUsageCount: USAGE },
  { request: { query: PlanMistakeEntriesDocument, variables: { planId: "plan-1" } }, result: { data: { planMistakeEntries: [] } }, maxUsageCount: USAGE },
  { request: { query: PlanNotesDocument, variables: { planId: "plan-1" } }, result: { data: { notes: [] } }, maxUsageCount: USAGE },
];

function mount() {
  return render(
    <TooltipProvider>
      {/* The graph is the default view since epic-16 T3 — the full page now
          mounts RoadmapGraph, which reads the theme (reduce-motion). */}
      <ThemeProvider>
        <LanguageProvider>
          <MockedProvider mocks={mocks}>
            <MemoryRouter initialEntries={["/plan/plan-1"]}>
              <Routes>
                <Route path="/plan/:id" element={<PlanHomePage />} />
              </Routes>
            </MemoryRouter>
          </MockedProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>,
  );
}

describe("Plan Home nodes zone — the graph is the default view (epic-16 T3)", () => {
  it("renders the roadmap graph on arrival with the Graph tab selected and List unselected", async () => {
    mount();

    expect(await screen.findByTestId("roadmap-canvas")).toBeInTheDocument();
    // The shadcn Tabs segmented control (owner round 2026-11-11): the graph
    // tab is selected on arrival.
    const graphTab = screen.getByRole("tab", { name: zhDict["plans.viewGraph"] });
    expect(graphTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: zhDict["plans.viewList"] })).toHaveAttribute("aria-selected", "false");
  });

  it("keeps List one click away — flipping swaps the nodes zone to the stage-grouped rows", async () => {
    mount();
    await screen.findByTestId("roadmap-canvas");

    // Radix Tabs activates on pointerdown (not click).
    const listTab = screen.getByRole("tab", { name: zhDict["plans.viewList"] });
    fireEvent.mouseDown(listTab, { button: 0 });
    fireEvent.click(listTab);

    expect(screen.queryByTestId("roadmap-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("节点 0")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: zhDict["plans.viewList"] })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: zhDict["plans.viewGraph"] })).toHaveAttribute("aria-selected", "false");
  });
});

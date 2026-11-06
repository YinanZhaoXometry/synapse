import { MockedProvider } from "@apollo/client/testing/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
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
 * Plan Home's fork attribution (OQ-12, epic P2-11 T3; delta decision 4 —
 * component render seam): an adopted plan's header carries the
 * 「改编自公开计划：X」 line straight off the server's fork-time snapshot
 * field (forkedFromTopic), and a hand-made plan (null snapshot) renders no
 * attribution. The full page mounts — attribution lives in the header beside
 * the plan identity it annotates.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const NOW = "2026-11-05T00:00:00Z";

const USAGE = 6;

const nodeFixture = {
  __typename: "KnowledgeNode",
  id: "n-1",
  planId: "plan-1",
  taskId: null,
  stage: "基础",
  title: "基础·概念",
  description: null,
  optional: false,
  order: 0,
  masteryScore: "10",
  state: "uncovered",
  createdAt: NOW,
};

const planDetail = (forkedFromTopic: string | null) => ({
  __typename: "StudyPlan",
  id: "plan-1",
  topic: "系统设计面试（改编）",
  goal: "八周准备",
  createdAt: NOW,
  masteryScore: "10",
  visibility: "private",
  forkedFromTopic,
  edges: [],
  nodes: [nodeFixture],
  materials: [],
});

/** Every read Plan Home issues on a materials-empty plan. */
function mocksFor(plan: Record<string, unknown>): MockedResponse[] {
  return [
    { request: { query: PlanDocument, variables: { id: "plan-1" } }, result: { data: { plan } }, maxUsageCount: USAGE },
    { request: { query: MaterialsDocument, variables: { planId: "plan-1" } }, result: { data: { materials: [] } }, maxUsageCount: USAGE },
    { request: { query: AllEvidenceDocument, variables: {} }, result: { data: { evidence: [] } }, maxUsageCount: USAGE },
    { request: { query: FlashcardsByPlanDocument, variables: { planId: "plan-1" } }, result: { data: { flashcards: [] } }, maxUsageCount: USAGE },
    { request: { query: StreakDocument, variables: {} }, result: { data: { streak: 0 } }, maxUsageCount: USAGE },
    { request: { query: PlanNodeMappingsDocument, variables: { planId: "plan-1" } }, result: { data: { planNodeMappings: [] } }, maxUsageCount: USAGE },
    { request: { query: PlanMistakeEntriesDocument, variables: { planId: "plan-1" } }, result: { data: { planMistakeEntries: [] } }, maxUsageCount: USAGE },
    { request: { query: PlanNotesDocument, variables: { planId: "plan-1" } }, result: { data: { notes: [] } }, maxUsageCount: USAGE },
  ];
}

function mount(mocks: MockedResponse[]) {
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

describe("Plan Home — fork attribution header line (OQ-12, delta decision 4)", () => {
  it("renders 「改编自公开计划：{topic}」 on an adopted plan's header (the server snapshot, verbatim)", async () => {
    mount(mocksFor(planDetail("系统设计面试")));

    const attribution = await screen.findByTestId("fork-attribution");
    expect(attribution).toHaveTextContent(
      zh("square.adaptedFrom").replace("{topic}", "系统设计面试"),
    );
  });

  it("renders no attribution on a plan that is not a fork", async () => {
    mount(mocksFor(planDetail(null)));

    // the page itself renders (the plan title is up)
    await waitFor(() => expect(screen.getByText("系统设计面试（改编）")).toBeInTheDocument());
    expect(screen.queryByTestId("fork-attribution")).not.toBeInTheDocument();
  });
});

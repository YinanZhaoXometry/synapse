/**
 * The /ai-tutor re-point tests (FR-46, epic P2-12 T3 — delta decision 2): the
 * retained page is a thin plan-picker over CompanionPanel in plan-grounding
 * mode; the Phase-1 demo keyword-response engine and its fixture replies are
 * RETIRED (their tests retired with them — the ticket's deliverable, not a
 * test-weakening). Pinned here: the plan picker renders the user's plans and
 * mounts the plan-grounded panel, no plans → the honest empty state, and no
 * demo residue (the retired fixture copy never renders again).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createHarnessState, createStubClient, makeStubWrapper, type HarnessState } from "@/test/apollo-harness";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import type { CompanionReply, PlanChatRequest } from "@/ai/types";
import AITutorPage from "./AITutorPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const NOW = "2026-11-01T00:00:00Z";
const PLAN_ID = "plan-1";

const planChatInputs: Array<PlanChatRequest> = [];
let fixtureReply: CompanionReply;

const stubService = (): CompanionService => ({
  chat: vi.fn(),
  planChat: (request, onToken) => {
    planChatInputs.push(request);
    onToken?.("第一");
    return Promise.resolve(fixtureReply);
  },
  generatePlanStructure: vi.fn(),
  generateQuiz: vi.fn(),
  generateFlashcards: vi.fn(),
  gradeOpenAnswer: vi.fn(),
});

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function plansHandlers(plans: Array<Record<string, unknown>>): LooseHandlers {
  return {
    Plans: () => plans,
    Materials: (variables) => (variables.planId === PLAN_ID ? [] : []),
    PlanMistakeEntries: () => [],
  };
}

function renderTutorPage(handlers: LooseHandlers) {
  const state = createHarnessState();
  const client = createStubClient(
    handlers as Record<string, (variables: Record<string, unknown>, state: HarnessState) => unknown>,
    state,
  );
  const Wrapper = makeStubWrapper(client);
  render(
    <Wrapper>
      <MemoryRouter>
        <LanguageProvider>
          <AITutorPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("AITutorPage — the plan-grounded re-point (FR-46, delta decision 2)", () => {
  beforeEach(() => {
    planChatInputs.length = 0;
    fixtureReply = {
      intent: "explain",
      rung: "hint",
      text: "先看节点层。",
      citations: [],
      canEscalate: false,
      language: "zh",
    };
    setCompanionService(stubService());
  });

  afterEach(() => {
    setCompanionService(null);
  });

  it("renders the plan picker over the user's plans and mounts the plan-grounded panel", async () => {
    renderTutorPage(plansHandlers([
      { __typename: "StudyPlan", id: PLAN_ID, topic: "软工备考", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
      { __typename: "StudyPlan", id: "plan-2", topic: "英语口语", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
    ]));

    // the header copy survives the re-point
    expect(await screen.findByText(zh("tutor.title"))).toBeTruthy();
    // the picker defaults to the first plan and lists both
    const picker = (await screen.findByDisplayValue("软工备考")) as HTMLSelectElement;
    const options = Array.from(picker.options).map((option) => option.text);
    expect(options).toEqual(["软工备考", "英语口语"]);
    // the plan-grounded panel mounts (its badge + intent shortcuts visible)
    expect(screen.getByText(zh("companion.planBadge"))).toBeTruthy();
    expect(screen.getByText(zh("tutor.suggestExplain"))).toBeTruthy();
    // NO demo residue: the RETIRED demo-engine note + fixture copy (the keys
    // left the dictionary with the engine) never render again — asserted by
    // the literal copy, the independent source.
    expect(screen.queryByText("演示回复基于关键词，不代表已检索你的材料。")).toBeNull();
    expect(screen.queryByText(/先把问题落到具体一段材料上/)).toBeNull();
  });

  it("asking from the page grounds on the PICKED plan (the picker drives planChat's planId)", async () => {
    renderTutorPage(plansHandlers([
      { __typename: "StudyPlan", id: PLAN_ID, topic: "软工备考", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
      { __typename: "StudyPlan", id: "plan-2", topic: "英语口语", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
    ]));
    await screen.findByDisplayValue("软工备考");

    const picker = screen.getByDisplayValue("软工备考") as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: "plan-2" } });

    fireEvent.click(screen.getByText(zh("tutor.suggestSummary")));
    await screen.findAllByText(fixtureReply.text);
    expect(planChatInputs).toHaveLength(1);
    expect(planChatInputs[0].planId).toBe("plan-2");
  });

  it("no plans → the honest empty state (never a fake conversation)", async () => {
    renderTutorPage(plansHandlers([]));

    expect(await screen.findByText(zh("tutor.noPlansTitle"))).toBeTruthy();
    expect(screen.getByText(zh("tutor.noPlans"))).toBeTruthy();
    expect(screen.queryByText(zh("companion.planBadge"))).toBeNull();
    expect(screen.queryByText("演示回复基于关键词，不代表已检索你的材料。")).toBeNull();
  });
});

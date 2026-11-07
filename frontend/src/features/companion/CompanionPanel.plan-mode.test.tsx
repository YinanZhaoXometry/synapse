/**
 * CompanionPanel plan-grounding mode tests (FR-46, epic P2-12 T3) —
 * deterministic, offline. The seam is injected (setCompanionService), so the
 * plan chat walk never opens a socket: the stub RECORDS the exact planChat
 * request (the observation point for the op/fields the driver sends) and
 * resolves a fixture CompanionReply whose citations ride a plan_companion
 * citation event shape ({locator, quote}).
 *
 * Pinned here: the four intent shortcuts (explain / quiz me / summarize /
 * analyze my mistakes per the scaffold tutor pattern — the chip text IS the
 * sent question), the mistake picker (picking a row sends THAT entry's id as
 * mistakeEntryId), and the citation chips rendering as-is (AD-5) from a
 * mistake-grounded fixture reply, labeled against the entry's source
 * material. Expected copy reads the dictionary directly, never recomputed.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import type { CompanionReply, PlanChatRequest } from "@/ai/types";
import type { Material } from "@/domain/entities";
import type { PlanMistakeEntryView } from "@/api";
import { CompanionPanel } from "./CompanionPanel";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const material: Material = {
  id: "mat-1",
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [{ id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" }],
  createdAt: "2026-11-01T00:00:00Z",
};

const mistakeEntry: PlanMistakeEntryView = {
  id: "mistake-1",
  questionId: "q-1",
  nodeId: "n-1",
  prompt: "集成测试的关注点是什么？",
  sourceMaterialId: "mat-1",
  sourceSectionId: "sec-1",
  sourceLocation: { kind: "markdown", sectionId: "sec-1" },
  userAnswer: "单元测试",
  forfeited: false,
  createdAt: "2026-11-02T00:00:00Z",
};

const planChatInputs: Array<PlanChatRequest> = [];
let fixtureReply: CompanionReply;

const stubService = (): CompanionService => ({
  chat: vi.fn(),
  planChat: (request, onToken) => {
    planChatInputs.push(request);
    onToken?.(fixtureReply.text.slice(0, 2));
    return Promise.resolve(fixtureReply);
  },
  generatePlanStructure: vi.fn(),
  generateQuiz: vi.fn(),
  generateFlashcards: vi.fn(),
  gradeOpenAnswer: vi.fn(),
});

function renderPanel(overrides: { mistakeEntries?: PlanMistakeEntryView[] } = {}) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <div className="h-[480px]">
          <CompanionPanel
            mode="plan"
            planId="plan-1"
            materials={[material]}
            mistakeEntries={[mistakeEntry]}
            {...overrides}
          />
        </div>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("CompanionPanel — plan-grounding mode (FR-46)", () => {
  beforeEach(() => {
    planChatInputs.length = 0;
    fixtureReply = {
      intent: "explain",
      rung: "hint",
      text: "先看节点层的顺序，材料里有对应章节。",
      citations: [],
      canEscalate: false,
      language: "zh",
    };
    setCompanionService(stubService());
  });

  afterEach(() => {
    setCompanionService(null);
  });

  it("renders the four intent shortcuts (explain / quiz me / summarize / analyze my mistakes)", () => {
    renderPanel();
    expect(screen.getByText(zh("tutor.suggestExplain"))).toBeTruthy();
    expect(screen.getByRole("button", { name: zh("tutor.suggestQuiz") })).toBeTruthy();
    expect(screen.getByText(zh("tutor.suggestSummary"))).toBeTruthy();
    expect(screen.getByText(zh("tutor.suggestMistake"))).toBeTruthy();
    // the plan-scope badge, never a reading-position badge
    expect(screen.getByText(zh("companion.planBadge"))).toBeTruthy();
  });

  it("an intent shortcut sends the chip text as the plan-grounded question (no mistake input)", async () => {
    renderPanel();
    // the chip is the BUTTON (the transcript also carries 考考我 now that
    // starters are always visible — epic-24 T4)
    fireEvent.click(screen.getByRole("button", { name: zh("tutor.suggestQuiz") }));

    await screen.findAllByText(fixtureReply.text);
    expect(planChatInputs).toHaveLength(1);
    expect(planChatInputs[0].planId).toBe("plan-1");
    expect(planChatInputs[0].question).toBe(zh("tutor.suggestQuiz"));
    expect(planChatInputs[0].mistakeEntryId).toBeUndefined();
    // the user's turn renders above the reply
    expect(screen.getByRole("button", { name: zh("tutor.suggestQuiz") })).toBeTruthy();
  });

  it("the mistake shortcut opens the picker; picking a row sends THAT entry id as mistakeEntryId", async () => {
    // The fixture reply carries the mistake's source locator — the citation
    // event shape the plan_companion stream emits (locator, quote null).
    fixtureReply = { ...fixtureReply, citations: [{ locator: { kind: "markdown", sectionId: "sec-1" }, quote: undefined }] };
    renderPanel();

    fireEvent.click(screen.getByText(zh("tutor.suggestMistake")));
    const row = await screen.findByText(mistakeEntry.prompt);
    fireEvent.click(row);

    await screen.findAllByText(fixtureReply.text);
    expect(planChatInputs).toHaveLength(1);
    expect(planChatInputs[0].mistakeEntryId).toBe("mistake-1");
    expect(planChatInputs[0].question).toBe(zh("tutor.suggestMistake"));
    // the picker closed on pick
    expect(screen.queryByText(zh("companion.mistakePickerTitle"))).toBeNull();
    // the citation chip renders from the fixture reply, labeled against the
    // entry's source material's section title (chips as-is, AD-5); a markdown
    // locator renders the title, never a page chip
    expect(screen.getByText("集成测试")).toBeTruthy();
  });

  it("the mistake shortcut is disabled with honest copy when the plan has no entries", () => {
    renderPanel({ mistakeEntries: [] });
    const chip = screen.getByText(zh("tutor.suggestMistake")).closest("button") as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    expect(chip.title).toBe(zh("companion.mistakePickerEmpty"));
  });

  it("a failed turn stays visible with the retry affordance and returns the typed text", async () => {
    const failing = stubService();
    failing.planChat = () => Promise.reject(new Error("boom"));
    setCompanionService(failing);

    renderPanel();
    const composer = screen.getByLabelText(zh("companion.planPlaceholder")) as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "计划的重点？" } });
    fireEvent.click(screen.getByLabelText(zh("companion.send")));

    await screen.findByText("计划的重点？");
    // the turn keeps its text visible + retry affordance; the typed text returns
    expect(screen.getByText(zh("companion.retry"))).toBeTruthy();
    expect((screen.getByLabelText(zh("companion.planPlaceholder")) as HTMLTextAreaElement).value).toBe("计划的重点？");
  });

  it("switching plans resets the ephemeral transcript (a plan switch is the same cut as a reload — 2026-11-06)", async () => {
    const view = renderPanel();
    fireEvent.click(screen.getByText(zh("tutor.suggestExplain")));
    await screen.findAllByText(fixtureReply.text);

    view.rerender(
      <MemoryRouter>
        <LanguageProvider>
          <div className="h-[480px]">
            <CompanionPanel mode="plan" planId="plan-2" materials={[material]} mistakeEntries={[mistakeEntry]} />
          </div>
        </LanguageProvider>
      </MemoryRouter>,
    );

    // plan-1's turns never render under plan-2; the composer is alive again.
    expect(screen.queryByText(fixtureReply.text)).toBeNull();
    expect(screen.getByText(zh("tutor.suggestExplain"))).toBeTruthy();
  });
});

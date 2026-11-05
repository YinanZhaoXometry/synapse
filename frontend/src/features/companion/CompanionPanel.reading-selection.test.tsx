/**
 * CompanionPanel reading mode — the selection grounding thread (FR-13, epic-13
 * T1). The selection bar's Ask action: (1) the composer pre-fills with a
 * question quoting the selection (honest grounding — the user SEES exactly
 * what the Companion will be asked about), and (2) the NEXT send carries the
 * selection text on the request, EXACTLY ONCE — a later turn grounds on its
 * own position, never a stale selection. The seam is injected
 * (setCompanionService — the plan-mode test's pattern) so no socket opens; the
 * Apollo persistence hooks are mocked at the module boundary (the persistence
 * walk is use-companion-chat's own tests' concern, not this thread's).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { setCompanionService } from "@/ai/companion-service";
import type { CompanionService } from "@/ai/companion-service";
import type { CompanionReply, GroundedChatRequest } from "@/ai/types";
import type { Material, ReadingLocator, ReadingPosition } from "@/domain/entities";
import { CompanionPanel, type AskPrefill } from "./CompanionPanel";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const appendMutate = vi.hoisted(() => vi.fn());

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    // the persistence walk is out of scope here — the thread hydrates empty
    // and appends no-op
    useChatThreadQuery: () => ({ data: undefined, loading: false, error: null, refetch: vi.fn() }),
    useAppendChatMessageMutation: () => ({ mutate: appendMutate, result: null }),
  };
});

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
  sections: [
    { id: "sec-0", title: "开篇", text: "intro text" },
    { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。" },
  ],
  createdAt: "2026-11-01T00:00:00Z",
};

const locator: ReadingLocator = { kind: "markdown", sectionId: "sec-1" };
const position: ReadingPosition = { locator, text: "集成测试关注组件之间的交互。" };

const chatRequests: GroundedChatRequest[] = [];
const fixtureReply: CompanionReply = {
  intent: "explain",
  rung: "hint",
  text: "先从选段里的概念说起。",
  citations: [],
  canEscalate: true,
  language: "zh",
};

const stubService = (): CompanionService => ({
  chat: (request, onToken) => {
    chatRequests.push(request);
    onToken?.("先从");
    return Promise.resolve(fixtureReply);
  },
  planChat: vi.fn(),
  generatePlanStructure: vi.fn(),
  generateQuiz: vi.fn(),
  generateFlashcards: vi.fn(),
  gradeOpenAnswer: vi.fn(),
});

function renderPanel(overrides: { selectionRef?: { current: string | null }; askPrefill?: AskPrefill | null } = {}) {
  return render(
    <LanguageProvider>
      <div className="h-[480px]">
        <CompanionPanel
          materialId="mat-1"
          material={material}
          positionRef={{ current: position }}
          displayLocator={locator}
          onJumpToLocator={() => undefined}
          selectionRef={overrides.selectionRef ?? { current: null }}
          askPrefill={overrides.askPrefill ?? null}
        />
      </div>
    </LanguageProvider>,
  );
}

const composer = () => screen.getByPlaceholderText(zhDict["companion.placeholder"]) as HTMLTextAreaElement;

beforeEach(() => {
  setCompanionService(stubService());
  chatRequests.length = 0;
  appendMutate.mockReset();
});

afterEach(() => {
  setCompanionService(null);
});

describe("CompanionPanel reading mode — the selection grounding thread (epic-13 T1)", () => {
  it("pre-fills the composer with a question quoting the selection (the user sees what rides)", () => {
    renderPanel({ askPrefill: { quote: "selected words", nonce: 1 } });

    expect(composer().value).toContain("selected words");
    expect(composer().value).toContain(zhDict["companion.askWithSelection"].split("{quote}")[0].trim());
  });

  it("carries the pending selection on the next send, exactly once", async () => {
    const selectionRef = { current: "selected words" };
    renderPanel({ selectionRef, askPrefill: { quote: "selected words", nonce: 1 } });

    // the user completes the pre-filled question with their own ask
    fireEvent.change(composer(), { target: { value: "「selected words」是什么意思？" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["companion.send"] }));

    await waitFor(() => {
      expect(chatRequests).toHaveLength(1);
    });
    expect(chatRequests[0].question).toBe("「selected words」是什么意思？");
    expect(chatRequests[0].selection).toBe("selected words");
    // consumed at send time — the ref is empty again
    expect(selectionRef.current).toBeNull();

    // a SECOND turn grounds without the stale selection
    fireEvent.change(composer(), { target: { value: "那下一节呢？" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["companion.send"] }));

    await waitFor(() => {
      expect(chatRequests).toHaveLength(2);
    });
    expect(chatRequests[1].selection).toBeUndefined();
    expect(chatRequests[1].question).toBe("那下一节呢？");
  });

  it("sends a plain turn without a pending selection untouched (no selection field)", async () => {
    renderPanel();

    fireEvent.change(composer(), { target: { value: "这一节讲了什么？" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["companion.send"] }));

    await waitFor(() => {
      expect(chatRequests).toHaveLength(1);
    });
    expect(chatRequests[0].selection).toBeUndefined();
  });
});

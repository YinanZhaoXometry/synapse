import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreateFlashcardsDocument,
  FlashcardsByMaterialDocument,
  FlashcardsByPlanDocument,
} from "@/types/graphql";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { Material, MaterialSection } from "@/domain/entities";
import { FlashcardLauncher } from "./FlashcardLauncher";

/**
 * FlashcardLauncher observable states (T3; spec testing seam 3 — component
 * render seam over MockedProvider, the cutover's Apollo test seam, with the
 * real driver + the simulated AI): no-studyable-materials disabled with its
 * bilingual reason, 「来自 N 份材料 · 正在生成闪卡」 cancellable with NO card
 * created on cancel, generation failure as a neutral toast with the form
 * intact for retry (no cards — spec story 8), and success persisting cards
 * that carry their SOURCE material reference plus per-card clientUuid
 * idempotency keys (AD-12). The mutation variables captured on the mock are
 * the persistence contract — the deck itself lives server-side now. Expected
 * copy reads the copy deck directly, never recomputed.
 */

// The failure switch: one seam override — generateFlashcards rejects while
// failed, every other call delegates to the real simulated adapter.
const failState = vi.hoisted(() => ({ fail: false }));

vi.mock("@/ai/companion-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/companion-service")>();
  const real = actual.getCompanionService();
  return {
    ...actual,
    getCompanionService: () => ({
      chat: (...args: Parameters<typeof real.chat>) => real.chat(...args),
      generatePlanStructure: (...args: Parameters<typeof real.generatePlanStructure>) => real.generatePlanStructure(...args),
      generateQuiz: (...args: Parameters<typeof real.generateQuiz>) => real.generateQuiz(...args),
      generateFlashcards: async (input: Parameters<typeof real.generateFlashcards>[0]) => {
        if (failState.fail) throw new Error("simulated outage");
        return real.generateFlashcards(input);
      },
      gradeOpenAnswer: (...args: Parameters<typeof real.gradeOpenAnswer>) => real.gradeOpenAnswer(...args),
    }),
  };
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
const zhN = (key: string, n: number) => zh(key).replace("{n}", String(n));

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

const material = (id: string, overrides: Partial<Material> = {}): Material => ({
  id,
  title: `讲义-${id}.md`,
  kind: "markdown",
  sizeBytes: 64,
  planId: "p-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections,
  createdAt: "2026-11-01T09:00:00Z",
  ...overrides,
});

// The persistence capture: every createFlashcards input lands here in order —
// the deck's slices per material, each card minting its clientUuid (AD-12).
interface CapturedCardsInput {
  materialId: string;
  nodeId: string | null;
  cards: Array<{ clientUuid: string; front: string; back: string }>;
}
let createInputs: CapturedCardsInput[] = [];

function createCardsMock() {
  return {
    request: {
      query: CreateFlashcardsDocument,
      variables: (vars) => {
        createInputs.push(vars.input);
        return true;
      },
    },
    result: (vars) => ({
      data: {
        __typename: "Mutation",
        createFlashcards: {
          __typename: "CreateFlashcardsPayload",
          cards: vars.input.cards.map((card: { front: string; back: string }, i: number) => ({
            __typename: "Flashcard",
            id: `${vars.input.materialId}-card-${i}`,
            materialId: vars.input.materialId,
            nodeId: vars.input.nodeId,
            front: card.front,
            back: card.back,
            difficulty: null,
            createdAt: "2026-11-04T00:00:00Z",
          })),
        },
      },
    }),
    maxUsageCount: 10,
  };
}

function renderLauncher(materials: Material[]) {
  const onCreated = vi.fn();
  render(
    <LanguageProvider>
      <MockedProvider
        mocks={[
          createCardsMock(),
          // the create's refetch sweep — the deck lists gain rows through these
          { request: { query: FlashcardsByMaterialDocument, variables: () => true }, result: { data: { flashcards: [] } }, maxUsageCount: 5 },
          { request: { query: FlashcardsByPlanDocument, variables: () => true }, result: { data: { flashcards: [] } }, maxUsageCount: 5 },
        ]}
      >
        <div>
          <Toaster />
          <FlashcardLauncher materials={materials} onCreated={onCreated} />
        </div>
      </MockedProvider>
    </LanguageProvider>,
  );
  return { onCreated };
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  createInputs = [];
  failState.fail = false;
  // the AD-12 mint rides crypto.randomUUID — jsdom's Crypto predates it
  vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FlashcardLauncher (FR-19; UX spine FlashcardStudy entry)", () => {
  it("no studyable materials: disabled with the bilingual reason, no start affordance", () => {
    renderLauncher([material("m-0", { parseState: "pending", sections: [] })]);
    expect(screen.getByTestId("flashcards-launcher-disabled")).toBeInTheDocument();
    expect(screen.getByText(zh("flashcards.launcher.needMaterial"))).toBeInTheDocument();
    expect(screen.queryByTestId("flashcards-launcher-start")).not.toBeInTheDocument();
    expect(createInputs).toHaveLength(0);
  });

  it("a parsed material with sections is offered as a deck source; generating shows 「来自 N 份材料 · 正在生成闪卡」 and cancel creates NO card, returning to the form", async () => {
    const first = material("m-1");
    const { onCreated } = renderLauncher([first]);
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId(`flashcards-source-${first.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    expect(await screen.findByTestId("flashcards-launcher-generating")).toBeInTheDocument();
    expect(screen.getByText(zhN("flashcards.launcher.generating", 1))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flashcards-launcher-cancel"));
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument(); // form is back

    await flush(800); // longer than the simulated 600ms beat — nothing may land
    expect(createInputs).toHaveLength(0); // cancel = no card, ever
    expect(onCreated).not.toHaveBeenCalled(); // a cancelled start never navigates to the study
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });

  it("generation failure: neutral toast, no card created, the form stays for a retry that succeeds", async () => {
    const first = material("m-1");
    const { onCreated } = renderLauncher([first]);
    failState.fail = true;
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    expect(await screen.findByText(zh("flashcards.launcher.failed"))).toBeInTheDocument();
    expect(screen.queryByTestId("flashcards-launcher-generating")).not.toBeInTheDocument();
    await flush(800);
    expect(createInputs).toHaveLength(0); // no cards — plan state untouched

    failState.fail = false; // the retry
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createInputs).toHaveLength(1); // one persisted deck for the one material
    expect(createInputs[0].materialId).toBe(first.id);
    expect(createInputs[0].nodeId).toBeNull();
    expect(createInputs[0].cards).toHaveLength(2); // one card per section (the generator's contract)
    // the persistence contract: source material references + per-card idempotency
    // keys (AD-12), self-rating starts honest — unrated
    for (const card of createInputs[0].cards) {
      expect(typeof card.clientUuid).toBe("string");
    }
    expect(createInputs[0].cards[0].front).toContain("集成测试");
    expect(createInputs[0].cards[1].front).toContain("需求工程");
  });

  it("success across TWO materials: cards persist per material in section order", async () => {
    const first = material("m-1");
    const second = material("m-2", {
      sections: [{ id: "sec-b1", title: "测试金字塔", text: "测试金字塔分层排序自动化测试。" }],
    });
    const { onCreated } = renderLauncher([first, second]);

    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    expect(createInputs).toHaveLength(2); // one persist tick per material
    expect(createInputs[0].materialId).toBe(first.id);
    expect(createInputs[1].materialId).toBe(second.id);
    expect(createInputs[0].cards.map((c) => c.front)).toEqual([
      "集成测试 — 要点是什么？",
      "需求工程 — 要点是什么？",
    ]);
    expect(createInputs[1].cards.map((c) => c.front)).toEqual(["测试金字塔 — 要点是什么？"]);
  });
});

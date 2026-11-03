import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createPlan, loadDb, registerMaterial } from "@/data";
import type { MaterialSection } from "@/domain/entities";
import { FlashcardLauncher } from "./FlashcardLauncher";

/**
 * FlashcardLauncher observable states (T3; spec testing seam 3 — component
 * render seam over the real driver + the simulated AI): no-studyable-materials
 * disabled with its bilingual reason, 「来自 N 份材料 · 正在生成闪卡」
 * cancellable with NO card created on cancel, generation failure as a neutral
 * toast with the form intact for retry (plan state untouched, no cards — spec
 * story 8), and success persisting cards that carry their SOURCE material
 * reference (AC 1). Expected copy reads the copy deck directly, never
 * recomputed.
 */

// The failure switch: one seam override — generateFlashcards rejects while
// failed, every other call delegates to the real simulated adapter.
const failState = { fail: false };
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

function seedMaterial(overrides: { parseState?: "parsed" | "pending"; sections?: MaterialSection[]; title?: string } = {}) {
  const { plan } = createPlan({ topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }] });
  const { material } = registerMaterial({
    title: overrides.title ?? "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: plan.id,
    taskId: null,
    sections: overrides.sections ?? sections,
    parseState: overrides.parseState ?? "parsed",
  });
  return { plan, material };
}

function renderLauncher(materials: ReturnType<typeof seedMaterial>["material"][]) {
  const onCreated = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <Toaster />
        <FlashcardLauncher materials={materials} onCreated={onCreated} />
      </QueryClientProvider>
    </LanguageProvider>,
  );
  return { onCreated };
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  localStorage.clear();
  failState.fail = false;
});

describe("FlashcardLauncher (FR-19; UX spine FlashcardStudy entry)", () => {
  it("no studyable materials: disabled with the bilingual reason, no start affordance, no cards", () => {
    const { material } = seedMaterial({ parseState: "pending", sections: [] });
    renderLauncher([material]);
    expect(screen.getByTestId("flashcards-launcher-disabled")).toBeInTheDocument();
    expect(screen.getByText(zh("flashcards.launcher.needMaterial"))).toBeInTheDocument();
    expect(screen.queryByTestId("flashcards-launcher-start")).not.toBeInTheDocument();
    expect(loadDb().flashcards).toHaveLength(0);
  });

  it("a parsed material with sections is offered as a deck source; generating shows 「来自 N 份材料 · 正在生成闪卡」 and cancel creates NO card, returning to the form", async () => {
    const { material } = seedMaterial();
    const { onCreated } = renderLauncher([material]);
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId(`flashcards-source-${material.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    expect(await screen.findByTestId("flashcards-launcher-generating")).toBeInTheDocument();
    expect(screen.getByText(zhN("flashcards.launcher.generating", 1))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flashcards-launcher-cancel"));
    expect(screen.getByTestId("flashcards-launcher")).toBeInTheDocument(); // form is back

    await flush(800); // longer than the simulated 600ms beat — nothing may land
    expect(loadDb().flashcards).toHaveLength(0); // cancel = no card, ever
    expect(onCreated).not.toHaveBeenCalled(); // a cancelled start never navigates to the study
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
  });

  it("generation failure: neutral toast, no card created, the form stays for a retry that succeeds", async () => {
    const { material } = seedMaterial();
    const { onCreated } = renderLauncher([material]);
    failState.fail = true;
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    expect(await screen.findByText(zh("flashcards.launcher.failed"))).toBeInTheDocument();
    expect(screen.queryByTestId("flashcards-launcher-generating")).not.toBeInTheDocument();
    await flush(800);
    expect(loadDb().flashcards).toHaveLength(0); // plan state untouched, no cards

    failState.fail = false; // the retry
    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const cards = loadDb().flashcards;
    expect(cards).toHaveLength(2); // one card per section (the generator's contract)
    expect(cards.every((c) => c.materialId === material.id)).toBe(true); // source material references
    expect(cards.every((c) => c.difficulty === null)).toBe(true); // self-rating starts honest — unrated
    expect(cards[0].front).toContain("集成测试");
    expect(cards[1].front).toContain("需求工程");
  });

  it("success across TWO materials: cards carry their own material's reference in section order", async () => {
    const first = seedMaterial({ title: "讲义一.md" }).material;
    const second = seedMaterial({
      title: "讲义二.md",
      sections: [{ id: "sec-b1", title: "测试金字塔", text: "测试金字塔分层排序自动化测试。" }],
    }).material;
    const { onCreated } = renderLauncher([first, second]);

    fireEvent.click(screen.getByTestId("flashcards-launcher-start"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    const cards = loadDb().flashcards;
    expect(cards).toHaveLength(3); // 2 sections + 1 section
    expect(cards.map((c) => c.materialId)).toEqual([first.id, first.id, second.id]);
    expect(cards.map((c) => c.front)).toEqual([
      "集成测试 — 要点是什么？",
      "需求工程 — 要点是什么？",
      "测试金字塔 — 要点是什么？",
    ]);
  });
});

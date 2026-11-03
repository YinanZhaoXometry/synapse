import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createPlan, loadDb, registerMaterial } from "@/data";
import type { MaterialSection } from "@/domain/entities";
import { QuizLauncher } from "./QuizLauncher";

/**
 * QuizLauncher observable states (T2; spec testing seam 3 — component render
 * seam over the real driver + the simulated AI): no-quizable-materials
 * disabled with its reason, the mode/scope form, generating cancellable with
 * NO session created on cancel, and generation failure as a neutral toast
 * with the form intact for retry (plan state untouched, no session — spec
 * story 8). Expected copy reads the copy deck directly, never recomputed.
 */

// The failure switch: one seam override — generateQuiz rejects while failed,
// every other call delegates to the real simulated adapter.
const failState = { fail: false };
vi.mock("@/ai/companion-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/companion-service")>();
  const real = actual.getCompanionService();
  return {
    ...actual,
    getCompanionService: () => ({
      chat: (...args: Parameters<typeof real.chat>) => real.chat(...args),
      generatePlanStructure: (...args: Parameters<typeof real.generatePlanStructure>) => real.generatePlanStructure(...args),
      generateQuiz: async (input: Parameters<typeof real.generateQuiz>[0]) => {
        if (failState.fail) throw new Error("simulated outage");
        return real.generateQuiz(input);
      },
      generateFlashcards: (...args: Parameters<typeof real.generateFlashcards>) => real.generateFlashcards(...args),
      gradeOpenAnswer: (...args: Parameters<typeof real.gradeOpenAnswer>) => real.gradeOpenAnswer(...args),
    }),
  };
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

function seedPlan(materialSections: MaterialSection[] | null) {
  const { plan, nodes } = createPlan({ topic: "软工备考", goal: null, nodes: [{ title: "软件测试", stage: "核心" }] });
  const material =
    materialSections === null
      ? null
      : registerMaterial({
          title: "复习讲义.md",
          kind: "markdown",
          sizeBytes: 64,
          planId: plan.id,
          taskId: null,
          sections: materialSections,
          parseState: "parsed",
        }).material;
  return { plan, nodes, material };
}

function renderLauncher(props: Partial<Parameters<typeof QuizLauncher>[0]> = {}) {
  const { plan, nodes, material } = seedPlan(props.materials === undefined ? sections : null);
  const onStarted = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Toaster />
          <QuizLauncher
            planId={plan.id}
            nodeIds={nodes.map((n) => n.id)}
            materials={props.materials ?? (material ? [material] : [])}
            onStarted={onStarted}
            {...props}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
  return { onStarted, material };
}

const flush = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  localStorage.clear();
  failState.fail = false;
});

describe("QuizLauncher (FR-18; UX spine QuizLauncher contract)", () => {
  it("no quizable materials: disabled state with the bilingual reason, no start affordance", () => {
    renderLauncher({ materials: [] });
    expect(screen.getByTestId("quiz-launcher-disabled")).toBeInTheDocument();
    expect(screen.getByText(zh("quiz.launcher.needMaterial"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-launcher-start")).not.toBeInTheDocument();
    expect(loadDb().sessions).toHaveLength(0);
  });

  it("form: the three modes + whole-plan and per-material scopes are offered; mix is the default", () => {
    const { material } = renderLauncher();
    expect(screen.getByTestId("quiz-mode-open")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("quiz-mode-choice")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("quiz-mode-mix")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("quiz-scope-plan")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId(`quiz-scope-${material.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quiz-mode-choice"));
    expect(screen.getByTestId("quiz-mode-choice")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("quiz-mode-mix")).toHaveAttribute("aria-checked", "false");
  });

  it("generating shows 「来自 N 份材料 · 正在出题」 and cancel creates NO session, returning to the form", async () => {
    renderLauncher();
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByTestId("quiz-launcher-generating")).toBeInTheDocument();
    expect(screen.getByText(zhN("quiz.launcher.generating", 1))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quiz-launcher-cancel"));
    expect(screen.getByTestId("quiz-launcher")).toBeInTheDocument(); // form is back

    await flush(800); // longer than the simulated 600ms beat — nothing may land
    expect(loadDb().sessions).toHaveLength(0); // cancel = no session, ever
    expect(screen.getByTestId("quiz-launcher-start")).toBeInTheDocument();
  });

  it("generation failure: neutral toast, no session created, the form stays for a retry that succeeds", async () => {
    const { onStarted } = renderLauncher();
    failState.fail = true;
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    expect(await screen.findByText(zh("quiz.launcher.failed"))).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-launcher-generating")).not.toBeInTheDocument();
    await flush(800);
    expect(loadDb().sessions).toHaveLength(0); // plan state untouched, no session

    failState.fail = false; // the retry
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const [sessionId] = onStarted.mock.calls[0];
    expect(loadDb().sessions).toHaveLength(1);
    expect(loadDb().sessions[0].id).toBe(sessionId);
    expect(loadDb().sessions[0].status).toBe("active");
  });

  it("success hands the persisted session id + the exact start input to the surface", async () => {
    const { onStarted } = renderLauncher();
    fireEvent.click(screen.getByTestId("quiz-mode-choice")); // a real param choice
    fireEvent.click(screen.getByTestId("quiz-launcher-start"));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const [sessionId, input] = onStarted.mock.calls[0];
    expect(typeof sessionId).toBe("string");
    expect(input.mode).toBe("choice");
    expect(input.materials).toHaveLength(1);
    expect(input.planId).toBeTruthy();
    expect(loadDb().sessions[0].mode).toBe("choice");
  });
});

function zhN(key: string, n: number) {
  return zh(key).replace("{n}", String(n));
}

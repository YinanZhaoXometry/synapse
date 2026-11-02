import { describe, expect, it } from "vitest";
import { getCompanionService } from "@/ai/companion-service";
import type { MaterialSection } from "@/domain/entities";

const svc = getCompanionService();

const sections: MaterialSection[] = [
  { id: "page-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "page-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
  { id: "page-3", title: "Design principles", text: "SOLID keeps modules cohesive and decoupled." },
  { id: "page-4", title: "测试层级", text: "单元测试之后是集成测试，再是系统测试。" },
];

const nodeIds = ["node-a", "node-b"];

describe("simulated quiz generation (materials-sourced, FR-18)", () => {
  it("every question traces to a provided section; headings become prompts", async () => {
    const qs = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "mix" });
    const sectionIds = new Set(sections.map((s) => s.id));
    expect(qs.length).toBeGreaterThanOrEqual(5);
    expect(qs.length).toBeLessThanOrEqual(8);
    for (const q of qs) {
      expect(sectionIds.has(q.sourceSectionId)).toBe(true);
      expect(q.sourceMaterialId).toBe("m-1");
      expect(["open", "choice"]).toContain(q.kind);
    }
    // heading-sourced: a choice question carries its section title
    expect(qs.some((q) => q.kind === "choice" && q.prompt.includes("集成测试"))).toBe(true);
    expect(qs.some((q) => q.kind === "choice" && q.prompt.includes("需求工程"))).toBe(true);
  });

  it("mode is respected: choice-only / open-only / mix contains both", async () => {
    const choice = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "choice" });
    expect(choice.every((q) => q.kind === "choice")).toBe(true);

    const open = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "open" });
    expect(open.every((q) => q.kind === "open")).toBe(true);

    const mix = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "mix" });
    expect(new Set(mix.map((q) => q.kind))).toEqual(new Set(["open", "choice"]));
  });

  it("every question is node-attributed via round-robin (AD-6)", async () => {
    const qs = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "mix" });
    expect(qs.every((q) => nodeIds.includes(q.nodeId))).toBe(true);
    expect(qs[0].nodeId).toBe("node-a");
    expect(qs[1].nodeId).toBe("node-b");
  });

  it("deterministic: identical inputs → identical questions", async () => {
    const a = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "mix" });
    const b = await svc.generateQuiz({ materials: [{ materialId: "m-1", sections }], nodeIds, mode: "mix" });
    expect(b).toEqual(a);
  });
});

describe("open-answer grading (spec: keyword-overlap ≥2/1/0)", () => {
  const source = sections[0];

  it("≥2 keyword hits → correct with rationale + citation", async () => {
    const g = await svc.gradeOpenAnswer({
      keywords: ["集成测试", "契约"],
      answer: "集成测试要验证接口契约，否则组件交互会失败。",
      sourceText: source.text,
      source: { kind: "pdf", page: 1 },
      language: "zh",
    });
    expect(g.outcome).toBe("correct");
    expect(g.rationale.length).toBeGreaterThan(0);
    expect(g.citation?.locator).toEqual({ kind: "pdf", page: 1 });
  });

  it("1 hit → partial; 0 hits → wrong", async () => {
    const partial = await svc.gradeOpenAnswer({
      keywords: ["集成测试", "契约"],
      answer: "集成测试很重要。",
      sourceText: source.text,
      source: { kind: "pdf", page: 1 },
      language: "zh",
    });
    expect(partial.outcome).toBe("partial");

    const wrong = await svc.gradeOpenAnswer({
      keywords: ["集成测试", "契约"],
      answer: "完全无关的回答",
      sourceText: source.text,
      source: { kind: "pdf", page: 1 },
      language: "zh",
    });
    expect(wrong.outcome).toBe("wrong");
  });
});

describe("simulated flashcard generation (FR-19)", () => {
  it("one card per section: heading front, sourced back", async () => {
    const cards = await svc.generateFlashcards({ materials: [{ materialId: "m-1", sections }] });
    expect(cards).toHaveLength(sections.length);
    expect(cards[0].front).toContain("集成测试");
    expect(cards.every((c) => c.back.length > 0)).toBe(true);
  });
});

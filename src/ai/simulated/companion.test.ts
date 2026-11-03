import { describe, expect, it } from "vitest";
import type { ReadingPosition } from "@/domain/entities";
import { getCompanionService } from "@/ai/companion-service";

const position: ReadingPosition = {
  locator: { kind: "pdf", page: 7 },
  text:
    "Integration testing focuses on the interactions between components. " +
    "Interface contracts must be verified before system testing begins. " +
    "集成测试关注组件之间的交互，接口契约必须在系统测试开始之前完成验证。",
};

const svc = getCompanionService();

describe("grounded chat (seam: CompanionService interface)", () => {
  it("grounds an explain question on the Reading Position with a citation, hint-first", async () => {
    const reply = await svc.chat({
      question: "为什么集成测试要先验证接口契约？",
      position,
      language: "zh",
    });
    expect(reply.intent).toBe("explain");
    expect(reply.rung).toBe("hint"); // hint-first ladder (NFR-2) — never a direct answer by default
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
    expect(reply.text.length).toBeGreaterThan(0);
    expect(reply.canEscalate).toBe(true); // escalation stays reachable
  });

  it("honors an explicit direct request at the answer rung, still cited", async () => {
    const reply = await svc.chat({
      question: "直接告诉我集成测试的定义",
      position,
      language: "zh",
    });
    expect(reply.rung).toBe("answer");
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
  });

  it("honors a direct request even with no keyword overlap — the ladder is never a wall (epic-4 port)", async () => {
    const reply = await svc.chat({
      question: "直接告诉我答案",
      position,
      language: "zh",
    });
    expect(reply.intent).toBe("direct");
    expect(reply.rung).toBe("answer");
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 }); // anchored, still cited
  });

  it("anchors the 解释 starter on the page even with no keyword overlap (epic-4 port)", async () => {
    const reply = await svc.chat({
      question: "解释这一页",
      position,
      language: "zh",
    });
    expect(reply.intent).toBe("explain");
    expect(reply.rung).toBe("hint");
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
  });

  it("says so honestly when the page cannot answer (NFR-1)", async () => {
    const reply = await svc.chat({
      question: "量子计算在业界的发展现状如何？",
      position,
      language: "en",
    });
    expect(reply.intent).toBe("beyond-material");
    expect(reply.citations).toHaveLength(0); // nothing to cite — never fakes grounding
    expect(reply.text.length).toBeGreaterThan(0);
  });

  it("replies arrive in the requested language (zh ≠ en for the same question)", async () => {
    const zh = await svc.chat({ question: "什么是集成测试？", position, language: "zh" });
    const en = await svc.chat({ question: "What is integration testing?", position, language: "en" });
    expect(zh.text).not.toEqual(en.text);
    expect(zh.language).toBe("zh");
    expect(en.language).toBe("en");
  });

  it("streams the reply through onToken before resolving", async () => {
    const chunks: string[] = [];
    const reply = await svc.chat(
      { question: "为什么集成测试要先验证接口契约？", position, language: "en" },
      (chunk) => chunks.push(chunk),
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toBe(reply.text);
  });

  it("escalated:true skips the hint ladder — the answer rung directly, still grounded + cited (FR-12 amendment)", async () => {
    const reply = await svc.chat({
      question: "为什么集成测试要先验证接口契约？",
      position,
      language: "zh",
      escalated: true,
    });
    expect(reply.rung).toBe("answer"); // the ladder is a ladder, never a wall
    expect(reply.intent).toBe("direct");
    expect(reply.citations).toHaveLength(1); // still grounded on the position
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
    expect(reply.text).toContain("答案");
  });

  it("escalated quiz-me reaches the answer rung too — skipping rungs is always allowed", async () => {
    const reply = await svc.chat({
      question: "考考我这一页",
      position,
      language: "zh",
      escalated: true,
    });
    expect(reply.rung).toBe("answer");
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
  });

  it("escalation never conjures grounding — an ungroundable question stays honest", async () => {
    const reply = await svc.chat({
      question: "量子计算在业界的发展现状如何？",
      position,
      language: "en",
      escalated: true,
    });
    expect(reply.intent).toBe("beyond-material");
    expect(reply.citations).toHaveLength(0); // nothing to cite — never fakes grounding
  });

  it("the summarizer starter grounds on the open page at the answer rung (FR-11)", async () => {
    const reply = await svc.chat({ question: "总结这一页", position, language: "zh" });
    expect(reply.rung).toBe("answer");
    expect(reply.citations[0].locator).toEqual({ kind: "pdf", page: 7 });
    expect(reply.text.length).toBeGreaterThan(0);
  });
});

describe("plan structure proposal (creation chat, spec Q4)", () => {
  it("same topic → identical structure (deterministic demo)", async () => {
    const a = await svc.generatePlanStructure("COMP5241 软件工程", "zh");
    const b = await svc.generatePlanStructure("COMP5241 软件工程", "zh");
    expect(b).toEqual(a);
  });

  it("software-engineering topic → the SE template, 4 stages / 8–12 nodes", async () => {
    const p = await svc.generatePlanStructure("软件测试与质量保证", "zh");
    expect(p.stages.length).toBe(4);
    const nodeCount = p.stages.reduce((sum, s) => sum + s.nodeTitles.length, 0);
    expect(nodeCount).toBeGreaterThanOrEqual(8);
    expect(nodeCount).toBeLessThanOrEqual(12);
    // stage names are non-empty and distinct — the exact copy stays in templates.ts
    const names = p.stages.map((s) => s.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(4);
  });

  it("non-SE topic → generic 4-stage fallback with topic-derived nodes", async () => {
    const p = await svc.generatePlanStructure("陶艺入门", "zh");
    expect(p.stages.length).toBe(4);
    expect(p.stages[0].nodeTitles[0]).toContain("陶艺入门");
    const nodeCount = p.stages.reduce((sum, s) => sum + s.nodeTitles.length, 0);
    expect(nodeCount).toBeGreaterThanOrEqual(8);
  });

  it("streams the proposal like chat before resolving", async () => {
    const chunks: string[] = [];
    await svc.generatePlanStructure("COMP5241 软件工程", "en", (c) => chunks.push(c));
    expect(chunks.length).toBeGreaterThan(1); // more than one emitted line
    expect(chunks.join("")).toContain("## ");
  });
});

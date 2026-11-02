import { describe, expect, it } from "vitest";
import type { PlanStructureProposal } from "@/ai/types";
import { toPlanCreateInput } from "./creation-mapping";

/** Known-good literal fixture — the simulated Companion's proposal shape (AD-5). */
const PROPOSAL: PlanStructureProposal = {
  topic: "软件工程期末备考",
  stages: [
    { name: "基础", nodeTitles: ["软件生命周期", "敏捷方法"] },
    { name: "核心", nodeTitles: ["需求分析", "测试策略"] },
  ],
  language: "zh",
};

describe("proposal → create-input mapping (spec seam 2: proposal + renames + goal → repository create input, AD-3/Q8)", () => {
  it("stage grouping: nodes carry their stage name, flattened in proposal stage order", () => {
    const input = toPlanCreateInput(PROPOSAL);
    expect(input.nodes.map((n) => [n.title, n.stage])).toEqual([
      ["软件生命周期", "基础"],
      ["敏捷方法", "基础"],
      ["需求分析", "核心"],
      ["测试策略", "核心"],
    ]);
  });

  it("rename application: renamed titles replace the originals, untouched titles pass through", () => {
    const input = toPlanCreateInput(PROPOSAL, { 需求分析: "用户故事与用例" });
    expect(input.nodes.map((n) => n.title)).toEqual([
      "软件生命周期",
      "敏捷方法",
      "用户故事与用例",
      "测试策略",
    ]);
    // stages are unaffected by renames
    expect(input.nodes.map((n) => n.stage)).toEqual(["基础", "基础", "核心", "核心"]);
  });

  it("goal passthrough: the optional goal lands verbatim; absent goal stays null", () => {
    expect(toPlanCreateInput(PROPOSAL).goal).toBeNull();
    expect(toPlanCreateInput(PROPOSAL, {}, "期末考 85+").goal).toBe("期末考 85+");
  });

  it("empty-proposal rejection: a proposal with no node titles is rejected", () => {
    const empty: PlanStructureProposal = { topic: "x", stages: [], language: "zh" };
    const emptyStage: PlanStructureProposal = {
      topic: "x",
      stages: [{ name: "基础", nodeTitles: [] }],
      language: "zh",
    };
    expect(() => toPlanCreateInput(empty)).toThrow();
    expect(() => toPlanCreateInput(emptyStage)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { PlanStructureProposal } from "@/ai/types";
import { proposalNodeKey, toPlanCreateInput } from "./creation-mapping";

/** Known-good literal fixture — the epic-16 proposal shape (stages carry
 * nodes[{title, description, optional}]; top-level title-paired edges). */
const PROPOSAL: PlanStructureProposal = {
  topic: "软件工程期末备考",
  stages: [
    {
      name: "基础",
      nodes: [
        { title: "软件生命周期", description: "从需求到维护的全过程", optional: false },
        { title: "敏捷方法" },
      ],
    },
    {
      name: "核心",
      nodes: [
        { title: "需求分析", description: "  ", optional: false },
        { title: "测试策略", optional: true },
      ],
    },
  ],
  edges: [
    ["软件生命周期", "需求分析"],
    ["敏捷方法", "测试策略"],
  ],
  language: "zh",
};

/** Deterministic mint — ids track the flat enumeration order, so the tests
 * can pin the title→id resolution without randomness. Fresh counter per call:
 * every test starts from node-1. */
const mint = () => {
  let n = 0;
  return () => `node-${(n += 1)}`;
};

describe("proposal → create-input mapping (spec seam 2: proposal + renames + goal → repository create input, AD-3/Q8)", () => {
  it("stage grouping: nodes carry their stage name, flattened in proposal stage order", () => {
    const input = toPlanCreateInput(PROPOSAL, {}, null, mint());
    expect(input.nodes.map((n) => [n.title, n.stage])).toEqual([
      ["软件生命周期", "基础"],
      ["敏捷方法", "基础"],
      ["需求分析", "核心"],
      ["测试策略", "核心"],
    ]);
  });

  it("epic-16 metadata: description rides trimmed (blank → null); optional only on true", () => {
    const input = toPlanCreateInput(PROPOSAL, {}, null, mint());
    expect(input.nodes.map((n) => [n.description, n.optional])).toEqual([
      ["从需求到维护的全过程", false],
      [null, false],
      [null, false], // whitespace-only description strips to null (the server's .strip.presence)
      [null, true],
    ]);
  });

  it("client node ids: every node mints a uuid at flatten time (AD-12, epic-16's edge addressing)", () => {
    const input = toPlanCreateInput(PROPOSAL, {}, null, mint());
    expect(input.nodes.map((n) => n.id)).toEqual(["node-1", "node-2", "node-3", "node-4"]);
  });

  it("edge resolution: title pairs resolve to the client-minted node ids, proposal order kept", () => {
    const input = toPlanCreateInput(PROPOSAL, {}, null, mint());
    expect(input.edges).toEqual([
      { fromNodeId: "node-1", toNodeId: "node-3" }, // 软件生命周期 → 需求分析
      { fromNodeId: "node-2", toNodeId: "node-4" }, // 敏捷方法 → 测试策略
    ]);
  });

  it("edgeless proposal: edges lands empty (a legacy shape never invents pairs)", () => {
    const input = toPlanCreateInput(
      { topic: "x", stages: [{ name: "基础", nodes: [{ title: "唯一节点" }] }], edges: [], language: "zh" },
      {},
      null,
      mint(),
    );
    expect(input.edges).toEqual([]);
  });

  it("unresolvable pair: an edge naming a title no node carries is dropped, creation not blocked", () => {
    const proposal: PlanStructureProposal = {
      ...PROPOSAL,
      edges: [["不存在的标题", "需求分析"], ["软件生命周期", "需求分析"]],
    };
    const input = toPlanCreateInput(proposal, {}, null, mint());
    expect(input.edges).toEqual([{ fromNodeId: "node-1", toNodeId: "node-3" }]);
  });

  it("duplicate-title pair: a repeated title resolves NOWHERE — pairs naming it drop deterministically", () => {
    // 需求分析 appears twice (stage 二轮) — every pair naming it is
    // unresolvable; pairs over unique titles survive.
    const dup: PlanStructureProposal = {
      topic: "复习",
      stages: [
        { name: "一轮", nodes: [{ title: "复习要点" }, { title: "练习题" }] },
        { name: "二轮", nodes: [{ title: "需求分析" }, { title: "需求分析" }] },
      ],
      edges: [["复习要点", "练习题"], ["复习要点", "需求分析"], ["需求分析", "练习题"], ["一轮", "二轮"]],
      language: "zh",
    };
    const input = toPlanCreateInput(dup, {}, null, mint());
    // Only the pair whose endpoints both carry unique titles survives.
    expect(input.edges).toEqual([{ fromNodeId: "node-1", toNodeId: "node-2" }]);
  });

  it("rename application: renames keyed by proposal order index replace only their node", () => {
    // index 2 = 需求分析 (flattened stage-then-title order)
    const input = toPlanCreateInput(PROPOSAL, { [proposalNodeKey(2)]: "用户故事与用例" }, null, mint());
    expect(input.nodes.map((n) => n.title)).toEqual([
      "软件生命周期",
      "敏捷方法",
      "用户故事与用例",
      "测试策略",
    ]);
    // stages are unaffected by renames
    expect(input.nodes.map((n) => n.stage)).toEqual(["基础", "基础", "核心", "核心"]);
  });

  it("renames are resolution-final: an edge naming a vanished (renamed-away) title drops", () => {
    // 需求分析 renamed → 用户故事与用例: the edge naming the OLD title no longer
    // resolves (the server's confirm resolves over the same final titles);
    // the untouched pair survives.
    const input = toPlanCreateInput(PROPOSAL, { [proposalNodeKey(2)]: "用户故事与用例" }, null, mint());
    expect(input.edges).toEqual([{ fromNodeId: "node-2", toNodeId: "node-4" }]);
  });

  it("duplicate titles in one proposal rename independently (order-index keys cannot collide)", () => {
    const dup: PlanStructureProposal = {
      topic: "复习",
      stages: [
        { name: "一轮", nodes: [{ title: "复习要点" }, { title: "练习题" }] },
        { name: "二轮", nodes: [{ title: "复习要点" }] },
      ],
      edges: [],
      language: "zh",
    };
    const input = toPlanCreateInput(dup, {
      [proposalNodeKey(0)]: "一轮 · 复习要点",
      [proposalNodeKey(2)]: "二轮 · 复习要点",
    }, null, mint());
    expect(input.nodes.map((n) => n.title)).toEqual(["一轮 · 复习要点", "练习题", "二轮 · 复习要点"]);
  });

  it("goal passthrough: the optional goal lands verbatim; absent goal stays null", () => {
    expect(toPlanCreateInput(PROPOSAL, {}, null, mint()).goal).toBeNull();
    expect(toPlanCreateInput(PROPOSAL, {}, "期末考 85+", mint()).goal).toBe("期末考 85+");
  });

  it("empty-proposal rejection: a proposal with no nodes is rejected", () => {
    const empty: PlanStructureProposal = { topic: "x", stages: [], edges: [], language: "zh" };
    const emptyStage: PlanStructureProposal = {
      topic: "x",
      stages: [{ name: "基础", nodes: [] }],
      edges: [],
      language: "zh",
    };
    expect(() => toPlanCreateInput(empty, {}, null, mint())).toThrow();
    expect(() => toPlanCreateInput(emptyStage, {}, null, mint())).toThrow();
  });
});

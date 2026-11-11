import { describe, expect, it } from "vitest";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView } from "@/api/views";
import { autoMappingTargets, unmappedNodeCount } from "./auto-mapping";

/**
 * Auto-mapping selection (epic-34 T3; GLOSSARY Auto-mapping) — the pure
 * helper behind the plan-page effect, tested like domain logic: inputs are
 * the plan's materials × the plan-wide mapping rows × this mount session's
 * fired set (+ the cap posture) → the materials to fire ONE mapping call
 * for. The binding criteria (ticket): parseState parsed ∧ sections present
 * ∧ zero mapping rows ∧ not fired this session; a cap-exhausted session
 * selects nothing. The unmapped-node summary is the same module's second
 * derivation: plan nodes with zero CONFIRMED rows — the material-mapping
 * axis (GLOSSARY Unmapped node), never the mastery axis.
 */

const material = (overrides: Partial<MaterialView> & { id: string }): MaterialView => ({
  title: `材料 ${overrides.id}`,
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [{ id: `${overrides.id}-sec-1`, title: "第一节", text: "内容" }],
  createdAt: "2026-11-11T00:00:00Z",
  downloadUrl: null,
  origin: "uploaded",
  generation: null,
  ...overrides,
});

const row = (overrides: Partial<MaterialNodeMappingView> & { id: string; materialId: string }): MaterialNodeMappingView => ({
  nodeId: null,
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "proposed",
  createdAt: "2026-11-11T00:00:00Z",
  ...overrides,
});

const node = (id: string): KnowledgeNodeView => ({
  id,
  planId: "plan-1",
  taskId: null,
  stage: null,
  title: `节点 ${id}`,
  order: 0,
  description: null,
  optional: false,
  studyMark: null,
  masteryScore: "0",
  state: "uncovered",
});

describe("autoMappingTargets", () => {
  it("selects a parsed material with sections and zero mapping rows", () => {
    const materials = [material({ id: "m-1" })];
    const targets = autoMappingTargets(materials, [], new Set(), false);
    expect(targets.map((m) => m.id)).toEqual(["m-1"]);
  });

  it("skips a material that already carries mapping rows — any status counts", () => {
    const materials = [material({ id: "m-1" })];
    const rows = [
      row({ id: "r-1", materialId: "m-1", status: "confirmed", nodeId: "n-1" }),
      row({ id: "r-2", materialId: "m-1", status: "rejected", proposedNodeTitle: "旧概念" }),
    ];
    expect(autoMappingTargets(materials, rows, new Set(), false)).toEqual([]);
  });

  it("skips a material whose parse has not landed or produced no sections", () => {
    const materials = [
      material({ id: "m-pending", parseState: "pending" }),
      material({ id: "m-parsing", parseState: "parsing" }),
      material({ id: "m-failed", parseState: "failed" }),
      material({ id: "m-empty", sections: [] }),
    ];
    expect(autoMappingTargets(materials, [], new Set(), false)).toEqual([]);
  });

  it("never re-fires a material already fired this mount session", () => {
    const materials = [material({ id: "m-1" })];
    expect(autoMappingTargets(materials, [], new Set(["m-1"]), false)).toEqual([]);
  });

  it("selects nothing while either read has not landed (undefined) — zero rows is not known before the mapping read lands", () => {
    const materials = [material({ id: "m-1" })];
    expect(autoMappingTargets(undefined, [], new Set(), false)).toEqual([]);
    expect(autoMappingTargets(materials, undefined, new Set(), false)).toEqual([]);
  });

  it("selects nothing once the daily cap is exhausted — the session stops spending", () => {
    const materials = [material({ id: "m-1" }), material({ id: "m-2" })];
    expect(autoMappingTargets(materials, [], new Set(), true)).toEqual([]);
  });

  it("walks every eligible material in input order — one target per material", () => {
    const materials = [material({ id: "m-1" }), material({ id: "m-2" }), material({ id: "m-3", parseState: "pending" })];
    const targets = autoMappingTargets(materials, [], new Set(), false);
    expect(targets.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("skips only the fired material among several", () => {
    const materials = [material({ id: "m-1" }), material({ id: "m-2" })];
    const targets = autoMappingTargets(materials, [], new Set(["m-1"]), false);
    expect(targets.map((m) => m.id)).toEqual(["m-2"]);
  });
});

describe("unmappedNodeCount", () => {
  it("counts plan nodes with zero CONFIRMED mapping rows — proposed does not count", () => {
    const nodes = [node("n-1"), node("n-2"), node("n-3")];
    const rows = [
      row({ id: "r-1", materialId: "m-1", status: "confirmed", nodeId: "n-1" }),
      row({ id: "r-2", materialId: "m-1", status: "proposed", nodeId: "n-2" }),
    ];
    expect(unmappedNodeCount(nodes, rows)).toBe(2);
  });

  it("ignores node-less gap proposals and rows of other nodes", () => {
    const nodes = [node("n-1")];
    const rows = [
      row({ id: "r-1", materialId: "m-1", proposedNodeTitle: "新概念" }),
      row({ id: "r-2", materialId: "m-2", status: "confirmed", nodeId: "n-other" }),
    ];
    expect(unmappedNodeCount(nodes, rows)).toBe(1);
  });

  it("every node is unmapped on the honest initial state (zero rows)", () => {
    const nodes = [node("n-1"), node("n-2")];
    expect(unmappedNodeCount(nodes, [])).toBe(2);
  });
});

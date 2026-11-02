import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "./document";
import {
  createPlan,
  deletePlan,
  getPlan,
  listNodesByPlan,
  listPlans,
  updatePlan,
} from "./plan-repository";
import { loadDb, resetDb } from "./store";

beforeEach(() => {
  localStorage.clear();
});

describe("plan repository (seam: public API over real localStorage)", () => {
  it("creates a plan with nodes and reads it back after a reload", () => {
    const { plan } = createPlan({
      topic: "COMP5241 期末",
      goal: "exam prep",
      nodes: [
        { title: "软件过程", stage: "基础" },
        { title: "需求工程", stage: "基础" },
      ],
    });

    expect(plan.id).toHaveLength(36); // crypto.randomUUID
    expect(plan.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601

    // reload simulation: everything below reads fresh from localStorage
    const loaded = getPlan(plan.id);
    expect(loaded?.topic).toBe("COMP5241 期末");
    expect(loaded?.goal).toBe("exam prep");

    const nodes = listNodesByPlan(plan.id);
    expect(nodes.map((n) => n.title)).toEqual(["软件过程", "需求工程"]);
    expect(nodes.every((n) => n.planId === plan.id && n.taskId === null)).toBe(true);

    expect(listPlans()).toHaveLength(1);
  });

  it("updates a plan in place", () => {
    const { plan } = createPlan({ topic: "T", goal: null, nodes: [] });
    updatePlan(plan.id, { topic: "COMP5241 final" });
    expect(getPlan(plan.id)?.topic).toBe("COMP5241 final");
  });

  it("deletes a plan together with its nodes", () => {
    const { plan } = createPlan({ topic: "T", goal: null, nodes: [{ title: "N", stage: null }] });
    deletePlan(plan.id);
    expect(getPlan(plan.id)).toBeUndefined();
    expect(listNodesByPlan(plan.id)).toHaveLength(0);
    expect(listPlans()).toHaveLength(0);
  });
});

describe("store migrations (adapter-owned, AD-4)", () => {
  it("migrates a prior-shape document forward instead of corrupting it", () => {
    // A pre-versioned document: plan without `goal`, no `sectionMarkings` collection.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        plans: [{ id: "p-legacy", topic: "Legacy", nodeIds: [], materialIds: [], createdAt: "2026-10-01T00:00:00Z" }],
        nodes: [{ id: "n-legacy", planId: "p-legacy", taskId: null, stage: null, title: "Old node", order: 0 }],
      }),
    );

    const db = loadDb();
    expect(db.version).toBe(1);
    expect(db.plans.map((p) => p.id)).toContain("p-legacy");
    expect(db.plans.find((p) => p.id === "p-legacy")?.goal).toBeNull(); // filled by migration
    expect(db.sectionMarkings).toEqual([]); // missing collection materialized
    expect(getPlan("p-legacy")?.topic).toBe("Legacy"); // readable through the repository
  });
});

describe("reset semantics", () => {
  it("reset clears data but keeps the versioned document", () => {
    createPlan({ topic: "T", goal: null, nodes: [{ title: "N", stage: null }] });
    resetDb();
    const db = loadDb();
    expect(db.version).toBe(1);
    expect(db.plans).toHaveLength(0);
    expect(db.nodes).toHaveLength(0);
  });
});

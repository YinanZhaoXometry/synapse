/**
 * Plan + KnowledgeNode repository (AD-3): the single owner of these entities.
 * All access goes through here (features reach it via TanStack Query hooks) —
 * no direct localStorage anywhere else.
 */
import type { KnowledgeNode, StudyPlan } from "@/domain/entities";
import { type SynapseDb } from "./document";
import { loadDb, saveDb, updateDb } from "./store";
import { AppError } from "./errors";

// -- queries -----------------------------------------------------------------

export function getPlan(id: string): StudyPlan | undefined {
  return loadDb().plans.find((p) => p.id === id);
}

export function listPlans(): StudyPlan[] {
  return loadDb().plans;
}

export function listNodesByPlan(planId: string): KnowledgeNode[] {
  return loadDb()
    .nodes.filter((n) => n.planId === planId)
    .sort((a, b) => a.order - b.order);
}

// -- mutations ---------------------------------------------------------------

export interface CreatePlanNodeInput {
  title: string;
  stage: string | null;
}

export function createPlan(input: {
  topic: string;
  goal: string | null;
  nodes: CreatePlanNodeInput[];
}): { plan: StudyPlan; nodes: KnowledgeNode[] } {
  const now = new Date().toISOString();
  const plan: StudyPlan = {
    id: crypto.randomUUID(),
    topic: input.topic,
    goal: input.goal,
    nodeIds: [],
    materialIds: [],
    createdAt: now,
  };
  const nodes: KnowledgeNode[] = input.nodes.map((n, i) => ({
    id: crypto.randomUUID(),
    planId: plan.id,
    taskId: null,
    stage: n.stage,
    title: n.title,
    order: i,
  }));
  plan.nodeIds = nodes.map((n) => n.id);

  const db: SynapseDb = loadDb();
  db.plans.push(plan);
  db.nodes.push(...nodes);
  saveDb(db);
  return { plan, nodes };
}

export function updatePlan(id: string, patch: Partial<Pick<StudyPlan, "topic" | "goal">>): StudyPlan {
  let updated!: StudyPlan;
  updateDb((db) => {
    const plan = db.plans.find((p) => p.id === id);
    if (!plan) throw new AppError("PLAN_NOT_FOUND", "errors.planNotFound");
    Object.assign(plan, patch);
    updated = plan;
  });
  return updated;
}

/** Cascade: a plan's nodes have no life outside it. */
export function deletePlan(id: string): void {
  updateDb((db) => {
    db.plans = db.plans.filter((p) => p.id !== id);
    db.nodes = db.nodes.filter((n) => n.planId !== id);
  });
}

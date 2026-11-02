/**
 * Proposal → create-input mapping (spec testing seam 2; FR-1/Q4/Q8): the pure
 * seam between the creation chat and the plan repository. A confirmed proposal
 * (+ inline renames + the optional goal) becomes the repository's create input —
 * no I/O, no React, so the confirm button can never improvise persistence shape.
 */
import type { PlanStructureProposal } from "@/ai/types";
import type { CreatePlanNodeInput } from "@/data/plan-repository";

/** Exactly the shape `createPlan` takes (AD-3) — the mapper's only output type. */
export interface PlanCreateInput {
  topic: string;
  goal: string | null;
  nodes: CreatePlanNodeInput[];
}

export function toPlanCreateInput(
  proposal: PlanStructureProposal,
  renames: Record<string, string> = {},
  goal: string | null = null,
): PlanCreateInput {
  const nodes: CreatePlanNodeInput[] = [];
  for (const stage of proposal.stages) {
    for (const title of stage.nodeTitles) {
      nodes.push({ title: renames[title] ?? title, stage: stage.name });
    }
  }
  if (nodes.length === 0) {
    // Nothing to persist — the UI guards this; the mapper refuses regardless.
    throw new Error("EMPTY_PLAN_PROPOSAL");
  }
  return { topic: proposal.topic, goal, nodes };
}

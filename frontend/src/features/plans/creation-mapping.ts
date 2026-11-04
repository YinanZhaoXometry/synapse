/**
 * Proposal → create-input mapping (spec testing seam 2; FR-1/Q4/Q8): the pure
 * seam between the creation chat and the api's createPlan mutation. A confirmed
 * proposal (+ inline renames + the optional goal) becomes the mutation input —
 * no I/O, no React, so the confirm button can never improvise persistence
 * shape. (The client-supplied plan uuid, AD-12's idempotency key, is minted at
 * the call site — this mapper stays pure data.)
 */
import type { PlanStructureProposal } from "@/ai/types";

/** One proposed node's shape on the createPlan input (title + optional stage). */
export interface CreatePlanNodeInput {
  title: string;
  stage: string | null;
}

/** Exactly the shape the createPlan mutation input takes — the mapper's only output type. */
export interface PlanCreateInput {
  topic: string;
  goal: string | null;
  nodes: CreatePlanNodeInput[];
}

/**
 * Stable per-node key for rename maps (review fix): the node's proposal-wide
 * order index as a string. Title-keyed maps collide when a proposal repeats a
 * title; the order index cannot. `toPlanCreateInput` and the creation chat's
 * rename UI both enumerate nodes in the same stage-then-title order, so both
 * derive identical keys for the same node.
 */
export function proposalNodeKey(orderIndex: number): string {
  return String(orderIndex);
}

export function toPlanCreateInput(
  proposal: PlanStructureProposal,
  renames: Record<string, string> = {},
  goal: string | null = null,
): PlanCreateInput {
  const nodes: CreatePlanNodeInput[] = [];
  let orderIndex = 0;
  for (const stage of proposal.stages) {
    for (const title of stage.nodeTitles) {
      nodes.push({ title: renames[proposalNodeKey(orderIndex)] ?? title, stage: stage.name });
      orderIndex += 1;
    }
  }
  if (nodes.length === 0) {
    // Nothing to persist — the UI guards this; the mapper refuses regardless.
    throw new Error("EMPTY_PLAN_PROPOSAL");
  }
  return { topic: proposal.topic, goal, nodes };
}

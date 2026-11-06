/**
 * Proposal → create-input mapping (spec testing seam 2; FR-1/Q4/Q8): the pure
 * seam between the creation chat and the api's createPlan mutation. A confirmed
 * proposal (+ inline renames + the optional goal) becomes the mutation input —
 * no I/O, no React, so the confirm button can never improvise persistence
 * shape. (The client-supplied plan uuid, AD-12's idempotency key, is minted at
 * the call site — this mapper stays pure data.)
 *
 * epic-16 (FR-5 data half): every node also mints a client uuid at flatten
 * time — the address the create input's title-resolved edge pairs reference —
 * and the proposal's title-paired edges resolve to those ids HERE, mirroring
 * the server's authority (Plans::ConfirmProposalCommand): a title that is
 * repeated or unknown resolves nowhere, so its pairs drop deterministically —
 * a dropped edge degrades the roadmap's visuals, it never blocks creation.
 * Resolution runs over the FINAL (post-rename) titles, exactly the rows the
 * server's confirm flattens; the server re-checks membership, stage-forward
 * validity, and dedupe over the id pairs.
 */
import { newClientUuid } from "@/lib/uuid";
import type { PlanStructureProposal } from "@/ai/types";

/** One proposed node's shape on the createPlan input (epic-16): the client
 * uuid + title + optional stage + the roadmap metadata. */
export interface CreatePlanNodeInput {
  id: string;
  title: string;
  stage: string | null;
  description: string | null;
  optional: boolean;
}

/** One id-paired prerequisite edge on the createPlan input (epic-16). */
export interface CreatePlanEdgeInput {
  fromNodeId: string;
  toNodeId: string;
}

/** Exactly the shape the createPlan mutation input takes — the mapper's only output type. */
export interface PlanCreateInput {
  topic: string;
  goal: string | null;
  nodes: CreatePlanNodeInput[];
  edges: CreatePlanEdgeInput[];
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
  mintNodeUuid: () => string = newClientUuid,
): PlanCreateInput {
  const nodes: CreatePlanNodeInput[] = [];
  const idByTitle = new Map<string, string | null>();
  let orderIndex = 0;
  for (const stage of proposal.stages) {
    for (const node of stage.nodes) {
      const title = renames[proposalNodeKey(orderIndex)] ?? node.title;
      const id = mintNodeUuid();
      nodes.push({
        id,
        title,
        stage: stage.name,
        // The server strips and nulls blank descriptions — mirror it here so
        // both sides flatten identically.
        description: node.description?.trim() || null,
        optional: node.optional === true,
      });
      // A repeated title maps NOWHERE: title-paired edges addressing it are
      // unresolvable (dropped below) — deterministic, mirroring the server.
      idByTitle.set(title, idByTitle.has(title) ? null : id);
      orderIndex += 1;
    }
  }
  if (nodes.length === 0) {
    // Nothing to persist — the UI guards this; the mapper refuses regardless.
    throw new Error("EMPTY_PLAN_PROPOSAL");
  }
  const resolve = (title: string): string | null => idByTitle.get(title) ?? null;
  const edges: CreatePlanEdgeInput[] = (proposal.edges ?? [])
    .map(([fromTitle, toTitle]) => {
      const fromNodeId = resolve(fromTitle);
      const toNodeId = resolve(toTitle);
      return fromNodeId && toNodeId ? { fromNodeId, toNodeId } : null;
    })
    .filter((edge): edge is CreatePlanEdgeInput => edge !== null);
  return { topic: proposal.topic, goal, nodes, edges };
}

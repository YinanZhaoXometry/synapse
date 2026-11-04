import { describe, expect, it } from "vitest";
import { createHarnessState, echoTouchedNodes, echoTouchedPlan } from "./apollo-harness";
import type { EchoFixture, HarnessState } from "./apollo-harness";

/**
 * The echo helpers' SERVER-SHAPE contract (epic P2-10 T3 review fix): the stub
 * plays by the api's rules (AD-14) — a touched node's echoed score is computed
 * over the node's FULL evidence history (KnowledgeNodeType#mastery_score), and
 * the plan's echoed rollup covers ALL the plan's nodes with uncovered ones
 * counting 0 (StudyPlanType#mastery_score) — never the current batch alone,
 * never the touched nodes alone. The RecordEvidence handlers' own order is
 * pinned too: the batch lands in state.evidence BEFORE the echo, so the
 * accumulated history already includes it.
 */

const DAY = 86_400_000;

/** A wire-shaped EvidenceRecord the harness's mapEvidence accepts. */
function evidenceRow(id: string, nodeId: string, outcome: string, createdAt: string): EchoFixture {
  return { __typename: "EvidenceRecord", id, nodeId, sessionId: "s-1", questionId: `${id}-q`, outcome, createdAt };
}

describe("echoTouchedNodes — the score rides the node's FULL evidence history", () => {
  it("a node with prior evidence scores over history + batch, never the batch alone", () => {
    const state = createHarnessState();
    const now = Date.now();
    state.evidence.push(
      evidenceRow("e-old-1", "node-1", "wrong", new Date(now - DAY).toISOString()),
      evidenceRow("e-old-2", "node-1", "wrong", new Date(now - DAY).toISOString()),
    );
    // the handler's order: the batch lands in state.evidence BEFORE the echo
    const batch = [evidenceRow("e-new-1", "node-1", "correct", new Date(now).toISOString())];
    state.evidence.push(...batch);

    const nodes = echoTouchedNodes(state, batch);
    expect(nodes).toHaveLength(1);
    // [wrong, wrong, correct] → mean 1/3 → 33 (the batch alone would read 100, capped to 99)
    expect(nodes[0].masteryScore).toBe("33");
    expect(nodes[0].state).toBe("partial");
  });

  it("still echoes ONLY the batch's touched nodes — prior history on other nodes is not echoed", () => {
    const state = createHarnessState();
    const now = Date.now();
    state.evidence.push(evidenceRow("e-old-1", "node-quiet", "correct", new Date(now).toISOString()));
    const batch = [evidenceRow("e-new-1", "node-1", "correct", new Date(now).toISOString())];
    state.evidence.push(...batch);

    expect(echoTouchedNodes(state, batch).map((n) => n.id)).toEqual(["node-1"]);
  });
});

describe("echoTouchedPlan — the rollup covers ALL the plan's nodes (uncovered counts 0)", () => {
  it("an untouched plan node counts 0 into the floored mean", () => {
    const state = createHarnessState();
    const now = Date.now();
    const batch = [evidenceRow("e-new-1", "node-1", "correct", new Date(now).toISOString())];
    state.evidence.push(
      evidenceRow("e-old-1", "node-1", "wrong", new Date(now - DAY).toISOString()),
      evidenceRow("e-old-2", "node-1", "wrong", new Date(now - DAY).toISOString()),
      ...batch,
    );
    const planNodes = [
      { __typename: "KnowledgeNode", id: "node-1" },
      { __typename: "KnowledgeNode", id: "node-2" },
    ];

    // node-1's full history reads 33; node-2 uncovered → 0; floor(33/2) = 16
    // (a touched-only or batch-only rollup would read 99 or 100)
    expect(echoTouchedPlan(state, "plan-1", planNodes)).toEqual({
      __typename: "StudyPlan",
      id: "plan-1",
      masteryScore: "16",
    });
  });

  it("null planId → null (a task-scoped session has no plan rollup)", () => {
    expect(echoTouchedPlan(createHarnessState(), null, [])).toBeNull();
  });
});

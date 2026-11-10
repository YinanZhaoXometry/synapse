# frozen_string_literal: true

module Types
  # A plan's structural unit, or a Study Task's single auto-created node
  # (AD-6 — planId and taskId are mutually exclusive, exactly one set). The
  # wire shape mirrors the Phase-1 TS KnowledgeNode
  # (frontend/src/domain/entities.ts): id/planId/taskId/stage/title/order
  # verbatim, plus createdAt (the server row's timestamp — the TS shape has
  # none; deviation recorded in the ticket Comments).
  class KnowledgeNodeType < Types::BaseObject
    description "A knowledge node: a plan's structural unit or a Study Task's owned node (AD-6)."

    field :id, String,
          null: false,
          description: "The node's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :plan_id, String,
          null: true,
          description: "The owning plan's uuid (null on a task-owned node, AD-6)."

    field :task_id, String,
          null: true,
          description: "The owning Study Task's uuid (null on a plan node, AD-6)."

    field :stage, String,
          null: true,
          description: "The stage grouping from the plan structure (e.g. 基础/核心/进阶/应用)."

    field :title, String,
          null: false,
          description: "The node's title."

    field :order, Int,
          null: false,
          description: "Position within the plan's node tree (the Phase-1 TS field name, verbatim)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the node was created."

    # The roadmap metadata (epic-16 T1, FR-5 data half): the one-line
    # description and the optional flag the graph renderer draws (optional
    # nodes render dashed). Null/false on legacy nodes — the columns are
    # new-generation artifacts, never backfilled (epic-16 delta decision 7).
    field :description, String,
          null: true,
          description: "The node's one-line description (epic-16). Null on legacy nodes — the field is a new-generation artifact, never backfilled."

    field :optional, Boolean,
          null: false,
          description: "Whether the node may be skipped without losing the thread (epic-16). Default false."

    # The Study Mark (FR-47, epic-28 T1): the user's self-declared status.
    # ORTHOGONAL to the mastery fields below by contract (ADR-0002) — a mark
    # is "where the user says they are", mastery is "what evidence proves
    # they know"; nothing computational reads the mark. Plain column read,
    # no resolver.
    field :study_mark, String,
          null: true,
          description: "The user's self-declared study status (FR-47): \"learning\" | \"finished\" | \"skipped\"; null = unmarked. ORTHOGONAL to mastery — a mark is never evidence and never feeds any score or state."

    # The Mastery Score fields (epic P2-4 ticket 03). The ONLY score source on
    # the wire (AD-14: the client renders, never recomputes) — both marshal
    # through Mastery (app/lib/mastery.rb, the api's one scoring
    # implementation, AD-6). The score travels as a String carrying the
    # integer percent: the golden-vector contract pins every score comparison
    # as exact string-decimal equality, so the wire value is lexically the
    # fixture's value end to end (Int-vs-String decision in the ticket's
    # Comments). Evidence arrives through the Dataloader source
    # (DataloaderSources::EvidenceRecordsSource) — one batched, user-scoped,
    # deterministically-ordered query per request tick across every node the
    # query touches (epic P2-4 review: findings P2-4 + P2-5a) — no longer the
    # per-node `object.evidence_records` association load.
    # `now: Time.current` engages the freshness cap (ADR-0001 amendment
    # 2026-11-04, ticket 04): the wire's score/state semantics include
    # freshness — a node whose latest evidence is more than 14 days old caps
    # at 99 and never reads mastered.
    field :mastery_score, String,
          null: false,
          description: "The node's Mastery Score (ADR-0001) as a string carrying the integer percent \"0\"..\"100\" — computed by the api's Mastery module over this node's evidence records (the client renders, never recomputes, AD-14). Freshness (ADR-0001 amendment 2026-11-04): with the latest evidence record more than 14 days old the score caps at \"99\" — the cap never lowers a sub-99 score. \"0\" with no evidence."

    field :state, String,
          null: false,
          description: "The node's mastery state over the same evidence: \"uncovered\" (no evidence) | \"partial\" | \"mastered\" (score ≥ 80 AND ≥ 3 records AND the latest evidence within the last 14 days — a decayed node never reads mastered) — Mastery's node-state vocabulary verbatim (AD-6)."

    def mastery_score
      Mastery.compute_node_score(evidence_for(object), now: Time.current).to_s
    end

    def state
      Mastery.node_state(evidence_for(object), now: Time.current)
    end

    private

    # The node's evidence, batch-loaded (see the source's comment for the
    # scoping + ordering postures).
    def evidence_for(node)
      dataload(DataloaderSources::EvidenceRecordsSource, context[:current_user].user.id, node.id)
    end
  end
end

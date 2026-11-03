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

    # The Mastery Score fields (epic P2-4 ticket 03). The ONLY score source on
    # the wire (AD-14: the client renders, never recomputes) — both marshal
    # through Mastery (app/lib/mastery.rb, the api's one scoring
    # implementation, AD-6). The score travels as a String carrying the
    # integer percent: the golden-vector contract pins every score comparison
    # as exact string-decimal equality, so the wire value is lexically the
    # fixture's value end to end (Int-vs-String decision in the ticket's
    # Comments). Scoping rides the association path (the epic-03 reads
    # convention): this node was resolved through the caller's own plan/task
    # path, so its evidence_records are the caller's own evidence.
    field :mastery_score, String,
          null: false,
          description: "The node's Mastery Score (ADR-0001) as a string carrying the integer percent \"0\"..\"100\" — computed by the api's Mastery module over this node's evidence records (the client renders, never recomputes, AD-14). \"0\" with no evidence."

    field :state, String,
          null: false,
          description: "The node's mastery state over the same evidence: \"uncovered\" (no evidence) | \"partial\" | \"mastered\" (score ≥ 80 AND ≥ 3 records) — Mastery's node-state vocabulary verbatim (AD-6)."

    def mastery_score
      Mastery.compute_node_score(object.evidence_records).to_s
    end

    def state
      Mastery.node_state(object.evidence_records)
    end
  end
end

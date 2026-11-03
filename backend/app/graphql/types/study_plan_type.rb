# frozen_string_literal: true

module Types
  # A study plan (AD-3) — the front door. The wire shape mirrors the Phase-1
  # TS StudyPlan (frontend/src/domain/entities.ts) where the wire is
  # concerned: id/topic/goal/createdAt verbatim; the TS nodeIds/materialIds
  # arrays are realized as associations (nodes here — materials arrive with
  # the materials ticket); visibility is the backend-only passthrough
  # (FR-38 — the TS shape has none).
  #
  # masteryScore (the rollup) landed with epic P2-4 ticket 03, per the
  # epic-03 ticket-1 placement decision — marshaled through Mastery, never
  # computed here (AD-6/AD-14).
  class StudyPlanType < Types::BaseObject
    description "A study plan (AD-3): the system gives the plan, never content."

    field :id, String,
          null: false,
          description: "The plan's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :topic, String,
          null: false,
          description: "What the plan studies."

    field :goal, String,
          null: true,
          description: "The optional study goal."

    field :visibility, String,
          null: false,
          description: "\"private\" (FR-38 default) or \"public\" (the Square opt-in)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the plan was created."

    field :nodes, [ Types::KnowledgeNodeType ],
          null: false,
          description: "The plan's node tree (the Phase-1 nodeIds array, realized as the association)."

    field :materials, [ Types::MaterialType ],
          null: false,
          description: "The plan's attached materials (the Phase-1 materialIds array, realized as the association — deferred from ticket 01 to the materials ticket)."

    # The plan rollup (epic P2-4 ticket 03): marshals every node's evidence —
    # the uncovered ones included, counting 0 (AD-6) — into Mastery's
    # floored mean. Scoping rides the association path (the epic-03 reads
    # convention): object came through the caller's own association path, so
    # its nodes and the evidence pinned to them (same user_id) are the
    # caller's own.
    field :mastery_score, String,
          null: false,
          description: "The plan's Mastery Score rollup (ADR-0001) as a string carrying the integer percent \"0\"..\"100\" — the floored mean of its nodes' scores with uncovered nodes counting 0; computed by the api's Mastery module (the client renders, never recomputes, AD-14). Rollup 100 ⇔ every node mastered."

    def mastery_score
      nodes = object.knowledge_nodes.to_a
      records = EvidenceRecord.where(user_id: object.user_id, node_id: nodes.map(&:id)).group_by(&:node_id)
      Mastery.compute_plan_rollup(nodes.to_h { |node| [ node.id, records.fetch(node.id, []) ] }).to_s
    end

    # The listNodesByPlan mirror (frontend/src/data/plan-repository.ts):
    # order is the sort key, verbatim.
    def nodes
      object.knowledge_nodes.order(:order)
    end

    # The plan-scoped material listing (frontend/src/data/material-repository.ts
    # listMaterialsByPlan), in attach order.
    def materials
      object.materials.order(:created_at)
    end
  end
end

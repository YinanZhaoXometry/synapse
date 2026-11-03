# frozen_string_literal: true

module Types
  # A study plan (AD-3) — the front door. The wire shape mirrors the Phase-1
  # TS StudyPlan (frontend/src/domain/entities.ts) where the wire is
  # concerned: id/topic/goal/createdAt verbatim; the TS nodeIds/materialIds
  # arrays are realized as associations (nodes here — materials arrive with
  # the materials ticket); visibility is the backend-only passthrough
  # (FR-38 — the TS shape has none).
  #
  # NO masteryScore — the epic-03 kickoff delta 1 pins the mastery fields out
  # of this epic's contract entirely; epic-04's ticket 3 adds them (fields +
  # resolver bodies) to this type. No placeholder nulls.
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

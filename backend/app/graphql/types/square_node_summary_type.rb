# frozen_string_literal: true

module Types
  # One node of a public plan, as the Square sees it (FR-39, epic P2-11 T2):
  # title/stage/order ONLY. This is the reduced public type set the epic
  # P2-4 forward-note demands — a SEPARATE type, not the shared
  # KnowledgeNodeType with fields toggled off — so the public path is
  # structurally incapable of leaking user content: there are no material,
  # annotation, score, identity, or task fields on it to select (NFR-7),
  # and KnowledgeNodeType's score resolvers are never handed a Square node.
  #
  # Deliberately no id either: the node's uuid addresses the OWNER's graph
  # (plan(id:) → nodes), not the public one; the Square previews structure,
  # never addresses private rows. Pinned field-for-field by
  # spec/graphql/square_public_types_spec.rb (the leak-proof AC).
  class SquareNodeSummaryType < Types::BaseObject
    description "One public plan node's structure summary (FR-39, the AD-13 exception): title, stage, and order ONLY — no scores, no content, no identity (NFR-7)."

    field :title, String,
          null: false,
          description: "The node's title."

    field :stage, String,
          null: true,
          description: "The stage grouping from the plan structure (e.g. 基础/核心/进阶/应用)."

    field :order, Int,
          null: false,
          description: "Position within the plan's node tree."
  end
end

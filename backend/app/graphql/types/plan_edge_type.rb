# frozen_string_literal: true

module Types
  # One prerequisite edge of a plan's roadmap (epic-16 T1): the from→to
  # learning-order dependency as its endpoints' uuid pair. Pure structure on
  # the wire — no progress semantics (evidence-only, ADR-0001); layout is the
  # client's deterministic derivation.
  class PlanEdgeType < Types::BaseObject
    description "A plan's prerequisite edge: a from→to learning-order dependency between two of the plan's nodes (epic-16)."

    field :from_node_id, String,
          null: false,
          description: "The source node's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :to_node_id, String,
          null: false,
          description: "The target node's uuid."
  end
end

# frozen_string_literal: true

module Types
  # One edge of a plan being created (epic-16 T1): an endpoint id pair — the
  # client resolves the proposal's title pairs against its client-supplied
  # node ids (the flatten seam) and sends ids. Endpoints must name the plan's
  # own nodes; anything else drops silently at the command (never blocks the
  # create).
  class PlanEdgeInput < Types::BaseInputObject
    graphql_name "CreatePlanEdgeInput"
    description "One id-paired edge of a plan being created (epic-16)."

    argument :from_node_id, String,
             required: true,
             description: "The source node's client-supplied uuid (AD-12)."

    argument :to_node_id, String,
             required: true,
             description: "The target node's client-supplied uuid (AD-12)."
  end
end

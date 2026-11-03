# frozen_string_literal: true

module Types
  # One node of a plan being created — the Phase-1 CreatePlanNodeInput
  # (frontend/src/data/plan-repository.ts) mirror: title required, stage
  # nullable. No id: node uuids are minted server-side at confirm (the
  # Phase-1 repo mints them client-side; the plan's client uuid is the
  # replay key for the whole aggregate).
  class PlanNodeInput < Types::BaseInputObject
    graphql_name "CreatePlanNodeInput"
    description "A node for a plan being created (Phase-1 CreatePlanNodeInput)."

    argument :title, String,
             required: true,
             description: "The node's title."

    argument :stage, String,
             required: false,
             description: "The stage grouping (nullable)."
  end
end

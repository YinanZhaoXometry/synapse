# frozen_string_literal: true

module Types
  # One node of a plan being created — the Phase-1 CreatePlanNodeInput
  # (frontend/src/data/plan-repository.ts) mirror: title required, stage
  # nullable. epic-16 T1: an OPTIONAL client-supplied id (absent → minted
  # server-side, as before) — the address edges' id pairs reference (the
  # client resolves the proposal's title pairs against these ids in the
  # flatten seam) — plus the roadmap metadata (description/optional).
  class PlanNodeInput < Types::BaseInputObject
    graphql_name "CreatePlanNodeInput"
    description "A node for a plan being created (Phase-1 CreatePlanNodeInput)."

    argument :id, String,
             required: false,
             description: "The node's client uuid (AD-12, epic-16) — the address the create input's edge pairs reference. Minted server-side when absent."

    argument :title, String,
             required: true,
             description: "The node's title."

    argument :stage, String,
             required: false,
             description: "The stage grouping (nullable)."

    argument :description, String,
             required: false,
             description: "The node's one-line description (nullable, epic-16)."

    argument :optional, Boolean,
             required: false,
             description: "Whether the node may be skipped without losing the thread (default false, epic-16)."
  end
end

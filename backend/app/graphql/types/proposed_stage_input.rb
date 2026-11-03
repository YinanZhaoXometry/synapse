# frozen_string_literal: true

module Types
  # One stage of a creation-chat plan proposal — the Phase-1 ProposedStage
  # (frontend/src/ai/types.ts PlanStructureProposal) mirror: a stage name and
  # its node titles in proposal order. The proposal's `language` field is a
  # UI concern and is deliberately not carried (nothing to persist it on).
  class ProposedStageInput < Types::BaseInputObject
    graphql_name "ProposedStageInput"
    description "One stage of a creation-chat plan proposal (Phase-1 ProposedStage)."

    argument :name, String,
             required: true,
             description: "The stage name."

    argument :node_titles, [ String, null: false ],
             required: true,
             description: "The stage's node titles, in proposal order."
  end
end

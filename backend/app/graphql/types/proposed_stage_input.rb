# frozen_string_literal: true

module Types
  # One stage of a creation-chat plan proposal — the Phase-1 ProposedStage
  # (frontend/src/ai/types.ts PlanStructureProposal) mirror. epic-16 T1
  # upgraded the proposal schema: a stage now carries full nodes
  # ({title, description, optional} — ProposedNodeInput) instead of bare
  # titles; the legacy `nodeTitles` shape stays accepted so pre-epic-16
  # proposals still confirm (the command prefers `nodes`, falls back to
  # `nodeTitles`). The proposal's `language` field is a UI concern and is
  # deliberately not carried (nothing to persist it on).
  class ProposedStageInput < Types::BaseInputObject
    graphql_name "ProposedStageInput"
    description "One stage of a creation-chat plan proposal (Phase-1 ProposedStage)."

    argument :name, String,
             required: true,
             description: "The stage name."

    argument :node_titles, [ String, null: false ],
             required: false,
             description: "The stage's node titles, in proposal order (the pre-epic-16 shape)."

    argument :nodes, [ Types::ProposedNodeInput ],
             required: false,
             description: "The stage's nodes with their roadmap metadata, in proposal order (epic-16)."
  end
end

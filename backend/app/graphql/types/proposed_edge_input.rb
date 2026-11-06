# frozen_string_literal: true

module Types
  # One edge of a proposal being confirmed (epic-16 T1): a title pair — the
  # proposal JSON's edges[[fromTitle, toTitle]] vocabulary verbatim, resolved
  # to the confirmed nodes server-side (membership/stage-forward/dedupe drops
  # happen in Plans::PlanCreation; an invalid edge never blocks the confirm).
  class ProposedEdgeInput < Types::BaseInputObject
    graphql_name "ProposedEdgeInput"
    description "One title-paired edge of a proposal being confirmed (epic-16)."

    argument :from_title, String,
             required: true,
             description: "The source node's title (its stage must come strictly before the target's)."

    argument :to_title, String,
             required: true,
             description: "The target node's title."
  end
end

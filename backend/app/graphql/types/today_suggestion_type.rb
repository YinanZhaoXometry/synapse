# frozen_string_literal: true

module Types
  # One suggestion card on the Today hub (delta decision 2's v1 shape, epic
  # P2-09 T1): the plan title + its weakest node — derived from SERVER state
  # fields only (Mastery scores; no AI surface, AD-16). The web deep-links
  # the node quick-test (/plan/:id/quiz?nodeId=); partial-v1 posture recorded
  # in the delta (epic-10-T5's real generation-backed slot may replace it).
  class TodaySuggestionType < Types::BaseObject
    description "A Today suggestion card (delta decision 2, v1): the plan and its weakest node, for the client's 节点快测 deep link."

    field :plan_id, String,
          null: false,
          description: "The plan's uuid (the deep link's plan scope)."

    field :plan_title, String,
          null: false,
          description: "The plan's topic title — what the card renders."

    field :node_id, String,
          null: false,
          description: "The weakest node's uuid (the deep link's nodeId)."

    field :node_title, String,
          null: false,
          description: "The weakest node's title — what the card renders."
  end
end

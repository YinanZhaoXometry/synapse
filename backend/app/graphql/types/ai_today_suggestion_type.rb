# frozen_string_literal: true

module Types
  # The generation-backed Today suggestion (epic-18 T2, spec decisions
  # 7–10): the AI's "study next" pick for one plan with its one-line reason,
  # produced ONLY by the explicit generateTodaySuggestion mutation and
  # re-readable all UTC day for free via the deterministic client-uuid
  # replay. NOT the todayHub card — the v1 heuristic suggestion
  # (TodaySuggestionType) rides todayHub verbatim and stays the
  # always-present base; this type is the on-demand generation's view.
  class AiTodaySuggestionType < Types::BaseObject
    description "The AI-generated \"study next\" suggestion for one plan (epic-18): the chosen node plus a one-line reason grounded in server-computed mastery facts. Persisted per (plan, UTC day); a same-day regeneration replays it for free. The heuristic v1 Today-hub card stays the always-present base."

    field :plan_id, String,
          null: false,
          description: "The plan's uuid (the deep link's plan scope)."

    field :node_id, String,
          null: false,
          description: "The suggested node's uuid (the deep link's nodeId — the same nodeQuickTestHref shape the v1 card deep-links)."

    field :node_title, String,
          null: false,
          description: "The suggested node's title — resolved server-side through the persisted node (the model never owns the name)."

    field :reason, String,
          null: false,
          description: "The AI's one-line why — grounded ONLY in the server-computed facts the prompt carried (mastery score, state, open mistakes)."

    field :day, String,
          null: false,
          description: "The suggestion's UTC day key (\"YYYY-MM-DD\" — the day-key convention): the replay key's day half; a new day spends a new generation."

    def node_title
      object.node.title
    end
  end
end

# frozen_string_literal: true

# The generation-backed Today suggestion (epic-18 T2, spec decisions 7–10):
# ONE persisted row per (user, plan, UTC day) — the AI's "study next" pick
# with its one-line reason, produced only by the explicit
# generateTodaySuggestion mutation and re-readable all day for free via the
# deterministic client_uuid replay. `client_uuid` is the replay key
# (Ai::TodaySuggestionKey's uuid5 — globally unique); `node` is the chosen
# target (the wire's nodeTitle resolves through it — the model never owns
# the title); `day` is the UTC generation day. The heuristic v1 card in
# todayHub is untouched by this table (addition, not replacement).
class TodaySuggestion < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan"
  belongs_to :node, class_name: "KnowledgeNode"
end

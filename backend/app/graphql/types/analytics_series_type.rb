# frozen_string_literal: true

module Types
  # The analyticsSeries read model (FR-26, epic P2-09 T1, delta decision 4):
  # the three real-data series the analytics page renders — per-node mastery,
  # weekly accuracy, consistency — aggregated server-side (AD-14), scoped to
  # the caller (AD-13), scored through the ONE scorer (AD-6).
  class AnalyticsSeriesType < Types::BaseObject
    description "The analytics series (FR-26): per-node mastery, the weekly accuracy trend (ISO weeks, Mon-UTC), and the 14-day consistency strip."

    field :node_mastery, [ Types::NodeMasteryEntryType ],
          null: false,
          description: "Every node of the caller's with its score/state through Mastery (freshness engaged)."

    field :weekly_accuracy, [ Types::WeeklyAccuracyPointType ],
          null: false,
          description: "The last 8 ISO weeks (Mon-UTC, current included) that carry any evidence, oldest first."

    field :consistency, [ Types::ConsistencyPointType ],
          null: false,
          description: "The last 14 UTC days (today included), every day answered — distinct evidence-producing sessions per day."
  end
end

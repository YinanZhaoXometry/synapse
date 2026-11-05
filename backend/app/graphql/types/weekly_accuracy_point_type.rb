# frozen_string_literal: true

module Types
  # One ISO-week bucket on the analyticsSeries' weeklyAccuracy series (FR-26,
  # epic P2-09 T1): evidence answers grouped by their ISO Monday-UTC week —
  # the last 8 weeks including the current one, weeks without evidence
  # omitted. weekStart is the Monday's day key ("YYYY-MM-DD", UTC) — the
  # streak's day-key convention (ADR-0001).
  class WeeklyAccuracyPointType < Types::BaseObject
    description "One week's accuracy (FR-26): evidence answers bucketed by ISO Monday-UTC week."

    field :week_start, String,
          null: false,
          description: "The ISO week's Monday as a UTC day key (\"YYYY-MM-DD\" — the streak's convention)."

    field :answered, Int,
          null: false,
          description: "Evidence records in the week (every graded answer — correct, partial, wrong)."

    field :correct, Int,
          null: false,
          description: "Graded answers reading outcome \"correct\"."
  end
end

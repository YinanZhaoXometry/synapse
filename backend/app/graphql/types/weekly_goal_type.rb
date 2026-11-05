# frozen_string_literal: true

module Types
  # The weekly goal read (FR-25's Phase-2 half, epic P2-09 T1, delta decision
  # 3): the user-set target against the evidence-producing sessions of the
  # current ISO week — SESSIONS, never minutes (SM-C3). currentWeekStart is
  # the ISO Monday as a UTC day key (the streak's convention).
  class WeeklyGoalType < Types::BaseObject
    description "The weekly goal (FR-25): target vs. distinct evidence-producing sessions in the current ISO week (Mon-UTC, SM-C3)."

    field :target, Int,
          null: false,
          description: "The user's weekly target (sessions/week; 1..21, default 3 — delta decision 3)."

    field :current_week_sessions, Int,
          null: false,
          description: "DISTINCT sessions that produced evidence in the current ISO week (Mon 00:00 UTC .. now)."

    field :current_week_start, String,
          null: false,
          description: "The current ISO week's Monday as a UTC day key (\"YYYY-MM-DD\")."
  end
end

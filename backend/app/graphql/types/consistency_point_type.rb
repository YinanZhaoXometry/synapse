# frozen_string_literal: true

module Types
  # One day on the analyticsSeries' consistency series (FR-26, epic P2-09 T1,
  # SM-C3): DISTINCT evidence-producing quiz sessions per UTC day, over the
  # last 14 days including today — all 14 days answer, zeros included (a
  # quiet day is still a day). day follows the streak's day-key convention
  # ("YYYY-MM-DD", UTC — Mastery's utc_day_key).
  class ConsistencyPointType < Types::BaseObject
    description "One day's study consistency (FR-26, SM-C3): distinct evidence-producing sessions in that UTC day."

    field :day, String,
          null: false,
          description: "The UTC day key (\"YYYY-MM-DD\" — Mastery's day-key convention)."

    field :session_count, Int,
          null: false,
          description: "Distinct sessions that produced evidence that day (sessions, never minutes — SM-C3)."
  end
end

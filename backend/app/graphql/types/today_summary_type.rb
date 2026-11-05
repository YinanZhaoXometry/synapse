# frozen_string_literal: true

module Types
  # The 今日学习 day-progress counts (FR-27, epic P2-09 T1). dueCount and
  # manualCount mirror the hub's own lists; doneCount is the count of the
  # user's done manual tasks (ManualTask carries no done-at timestamp, so no
  # honest day-scoping exists — recorded in the ticket's ## Comments for T3).
  class TodaySummaryType < Types::BaseObject
    description "The 今日学习 day counts: due reviews, open manual tasks, done manual tasks."

    field :due_count, Int,
          null: false,
          description: "How many reviews are due today (the hub's due list length)."

    field :manual_count, Int,
          null: false,
          description: "How many manual tasks are still open (the hub's manual list length)."

    field :done_count, Int,
          null: false,
          description: "How many manual tasks are marked done (all time — the flag carries no done-at timestamp)."
  end
end

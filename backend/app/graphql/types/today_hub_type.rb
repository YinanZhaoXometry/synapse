# frozen_string_literal: true

module Types
  # The 今日学习 assembly, server-side (FR-27, epic P2-09 T1, delta decision
  # 4): the day's due reviews (epic-07's materialized re-queue schedule — the
  # SAME source and relation the dueItems query answers with, never
  # re-derived), the suggestion slot (delta decision 2's v1 partial posture —
  # server state fields only, the client picks and links), the user's own
  # manual tasks, and the summary counts. Today = the caller's injected now.
  class TodayHubType < Types::BaseObject
    description "The 今日学习 assembly (FR-27): due reviews, quick-test suggestions (v1 partial), the user's manual tasks, and the day's summary counts."

    field :due, [ Types::DueItemType ],
          null: false,
          description: "The day's due reviews — epic-07's due logic verbatim: the materialized re-queue schedule, inclusive by the UTC day's end (an overdue item is still due, never silently dropped)."

    field :suggestions, [ Types::TodaySuggestionType ],
          null: false,
          description: "The per-weak-plan quick-test suggestions (delta decision 2, v1 partial): one card per plan with ≥1 non-mastered node and ≥1 confirmed mapping — the weakest node by server score, ties to the lowest order. The client renders and deep-links (/plan/:id/quiz?nodeId=); the server score stays the only truth."

    field :manual, [ Types::ManualTaskType ],
          null: false,
          description: "The user's open manual tasks (calendar order: due date ascending with undated last, then creation order). The done ones count in the summary."

    field :summary, Types::TodaySummaryType,
          null: false,
          description: "The day's counts: due reviews, open manual tasks, done manual tasks."
  end
end

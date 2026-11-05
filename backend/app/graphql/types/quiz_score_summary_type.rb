# frozen_string_literal: true

module Types
  # One session's honest score on the quizHistoryHub read model (FR-42, epic
  # P2-09 T1, delta decision 4): correct = the graded-correct count, total =
  # the graded-answered count — one EvidenceRecord per ANSWERED question is
  # the quiz results' own correctness definition (RecordEvidenceCommand), so
  # open unanswered/awaiting questions are excluded from both (they only
  # count in questionCount).
  class QuizScoreSummaryType < Types::BaseObject
    description "A session's score summary (FR-42): graded answers only — unanswered/awaiting questions excluded honestly."

    field :correct, Int,
          null: false,
          description: "How many graded answers read outcome \"correct\"."

    field :total, Int,
          null: false,
          description: "How many answers were graded at all (the answered questions — not the session's full question count)."
  end
end

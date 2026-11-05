# frozen_string_literal: true

module Types
  # One session row on the quizHistoryHub read model (FR-42, epic P2-09 T1,
  # delta decision 4): every session newest-first — abandoned/active ones
  # ride at zero graded answers (honest), completed ones carry their
  # graded-correct summary. planTitle is the plan-scoped session's topic;
  # task-scoped sessions carry the task triangle instead.
  class QuizHistoryEntryType < Types::BaseObject
    description "One quiz session on the history hub (FR-42): scope, mode, question count, and the graded-answers score summary."

    field :session_id, String,
          null: false,
          description: "The quiz session's uuid."

    field :plan_id, String,
          null: true,
          description: "The plan the session quizzes (null on a task-scoped session)."

    field :plan_title, String,
          null: true,
          description: "The plan's topic title (null on a task-scoped session)."

    field :task_id, String,
          null: true,
          description: "The task the session quizzes (null on a plan-scoped session)."

    field :mode, String,
          null: false,
          description: "\"open\" | \"choice\" | \"mix\" (the QuizMode vocabulary)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the session was created (the history's ordering key, newest first)."

    field :question_count, Int,
          null: false,
          description: "How many questions the session carries (answered or not)."

    field :score_summary, Types::QuizScoreSummaryType,
          null: false,
          description: "The graded-answers summary — correct/answered, computed server-side (AD-14)."

    # The row carries correct/answered flat; the wire nests them (the shape
    # delta decision 4 pins).
    def score_summary
      { correct: object.correct, total: object.answered }
    end
  end
end

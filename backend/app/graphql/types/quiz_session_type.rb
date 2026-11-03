# frozen_string_literal: true

module Types
  # An Open/Choice/Mix quiz session — the Phase-1 TS QuizSession shape
  # (frontend/src/domain/entities.ts): id/planId/taskId/mode/status/createdAt/
  # completedAt. The TS questionIds array is realized as the questions
  # association (epic P2-1 ticket 02's ER decision) — read back in generation
  # order (insertion order; the ER carries no order column, deviation recorded
  # in the ticket Comments).
  class QuizSessionType < Types::BaseObject
    description "A quiz session: plan- or task-scoped (exactly one — the ER's ownership law), carrying its node-attributed questions."

    field :id, String,
          null: false,
          description: "The session's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :plan_id, String,
          null: true,
          description: "The plan the session quizzes (null on a task-scoped session)."

    field :task_id, String,
          null: true,
          description: "The task the session quizzes (null on a plan-scoped session) — the plan-free quiz scope is the task triangle."

    field :mode, String,
          null: false,
          description: "\"open\" | \"choice\" | \"mix\" (the QuizMode vocabulary)."

    field :status, String,
          null: false,
          description: "\"active\" | \"completed\" | \"abandoned\" (abandon is terminal and writes no evidence)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the session was created."

    field :completed_at, Types::DateTime,
          null: true,
          description: "When the evidence batch completed the session (null until then)."

    field :questions, [ Types::QuestionType ],
          null: false,
          description: "The session's questions in generation order (the Phase-1 questionIds array, realized as the association)."

    def questions
      object.questions.order(:created_at, :id)
    end
  end
end

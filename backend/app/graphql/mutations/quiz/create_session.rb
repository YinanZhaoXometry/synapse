# frozen_string_literal: true

module Mutations
  module Quiz
    # Create a quiz session with its node-attributed questions — thin per
    # AD-12: parse → authorize (current_user!) → command → map. Every rule
    # (the one-transaction session+questions write, the exactly-one-owner
    # scope law, choice-shape validation, idempotent replay, uuid ownership,
    # the per-question node/material addresses) lives in
    # ::Quiz::CreateSessionCommand — note the leading :: (ticket 01's trap: a
    # bare Quiz:: inside Mutations::Quiz lexically resolves to
    # Mutations::Quiz::); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class CreateSession < BaseMutation
      description "Create a quiz session with its node-attributed questions (AD-6 — attribution at generation time), in one transaction. Scope it by plan or task (exactly one). Idempotent on clientUuid: a same-user replay returns the existing rows; a uuid owned by another user fails VALIDATION_FAILED."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied session uuid (AD-12) — the idempotency key for the create."

      argument :plan_id, String,
               required: false,
               description: "Scope the session to a plan. Exactly one of planId/taskId. Unknown or foreign ids are NOT_FOUND."

      argument :task_id, String,
               required: false,
               description: "Scope the session to a task (the plan-free quiz scope — the task triangle). Exactly one of planId/taskId. Unknown or foreign ids are NOT_FOUND."

      argument :mode, String,
               required: true,
               description: "\"open\" | \"choice\" | \"mix\" (the QuizMode vocabulary)."

      argument :questions, [ Types::QuizQuestionInput ],
               required: true,
               description: "The generated questions, each carrying its nodeId attribution (AD-6) and materials-sourced provenance."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The created (or replayed) session."

      field :questions, [ Types::QuestionType ],
            null: false,
            description: "The session's questions in generation order."

      def resolve(client_uuid:, mode:, questions:, plan_id: nil, task_id: nil)
        command_result(::Quiz::CreateSessionCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          plan_id: plan_id,
          task_id: task_id,
          mode: mode,
          questions: questions.map(&:to_h)
        ))
      end
    end
  end
end

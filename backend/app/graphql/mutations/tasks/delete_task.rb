# frozen_string_literal: true

module Mutations
  module Tasks
    # Delete a study task (epic-28 T4) — thin per AD-12: parse → authorize
    # (current_user!) → command → map. The cascade lives in
    # ::Tasks::DeleteTaskCommand: a plan-free task's material, auto-node,
    # and dependent rows go in one transaction (the deletePlan mirror); a
    # promoted task is a read-only pointer — the pointer and its task-scope
    # quiz history go, the plan keeps its content. A foreign or unknown id
    # is NOT_FOUND (delta 2). No idempotency rule applies — a delete is
    # by-id addressing, not a client-uuid create.
    class DeleteTask < BaseMutation
      description "Delete a study task. A plan-free task's material, auto-node, and dependent rows (quiz sessions, evidence, mistakes, flashcards, annotations, progress, chat thread) go with it in one transaction — the deletePlan mirror. A promoted task is a read-only pointer: deleting it removes the pointer and its task-scope quiz history only; the plan keeps its content. Cross-user ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The task's uuid."

      field :deleted_task_id, String,
            null: false,
            description: "The deleted task's uuid — for client cache eviction."

      def resolve(id:)
        command_result(::Tasks::DeleteTaskCommand.call(current_user: current_user!, id: id))
      end
    end
  end
end

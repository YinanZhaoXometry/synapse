# frozen_string_literal: true

module Mutations
  module Tasks
    # Create a study task — thin per AD-12: parse → authorize (current_user!)
    # → command → map. Every creation rule (the task + auto-node transaction,
    # idempotent replay, uuid ownership, material scoping) lives in
    # ::Tasks::CreateTaskCommand — note the leading :: (ticket 01's trap: a
    # bare Tasks:: inside Mutations::Tasks lexically resolves to
    # Mutations::Tasks::); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class CreateTask < BaseMutation
      description "Create a study task (AD-6): one material and its single auto-created node, in one transaction. Idempotent on clientUuid: a same-user replay returns the existing rows; a uuid owned by another user fails VALIDATION_FAILED."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied task uuid (AD-12) — the idempotency key for the create."

      argument :material_id, String,
               required: true,
               description: "The material to study. Unknown, foreign, or malformed ids are NOT_FOUND."

      field :task, Types::StudyTaskType,
            null: false,
            description: "The created (or replayed) task."

      field :node, Types::KnowledgeNodeType,
            null: false,
            description: "The task's single auto-created node (planId null, taskId set — AD-6)."

      def resolve(client_uuid:, material_id:)
        command_result(::Tasks::CreateTaskCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          material_id: material_id
        ))
      end
    end
  end
end

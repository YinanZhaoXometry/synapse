# frozen_string_literal: true

module Mutations
  module Tasks
    # Promote a study task into a study plan (FR-37 stretch half, epic-14 T2)
    # — thin per AD-12: parse → authorize (current_user!) → command → map.
    # Every promotion rule (the one transaction, the node's id-stable move,
    # the material re-point, the pointer flip, both idempotency levels,
    # scoping) lives in ::Tasks::PromoteTaskToPlanCommand — note the leading
    # :: (ticket 01's trap: a bare Tasks:: inside Mutations::Tasks lexically
    # resolves to Mutations::Tasks::); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class PromoteTaskToPlan < BaseMutation
      description "Promote a study task into a study plan (FR-37 stretch): the task's single auto-node becomes the plan's first node with its id unchanged (evidence and Mastery Scores carry over untouched), the material attaches plan-wide, and the task becomes a read-only pointer to the plan. Idempotent: a same-clientUuid replay and an already-promoted task both return the existing pointer."

      argument :task_id, String,
               required: true,
               description: "The task to promote. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied plan uuid (AD-12) — the idempotency key for the created plan."

      argument :topic, String,
               required: false,
               description: "The new plan's topic. Defaults to the task's material title when absent."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The created (or replayed) study plan — the promotion target."

      field :task, Types::StudyTaskType,
            null: false,
            description: "The promoted task, now the read-only pointer to the plan."

      def resolve(task_id:, client_uuid:, topic: nil)
        command_result(::Tasks::PromoteTaskToPlanCommand.call(
          current_user: current_user!,
          task_id: task_id,
          client_uuid: client_uuid,
          topic: topic
        ))
      end
    end
  end
end

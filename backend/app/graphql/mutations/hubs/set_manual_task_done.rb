# frozen_string_literal: true

module Mutations
  module Hubs
    # The manual-task completion toggle (FR-27, epic P2-09 T3) — thin per
    # AD-12: authorize (current_user!) → command → map. The idempotency law
    # (same state → the unchanged row, updated_at untouched) and the uniform
    # NOT_FOUND matrix live in ::Progress::SetManualTaskDoneCommand.
    class SetManualTaskDone < BaseMutation
      description "Toggle a manual task's done flag (FR-27). Idempotent: toggling to the state the row already carries returns it unchanged (updated_at untouched). Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The manual task's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :done, Boolean,
               required: true,
               description: "The completion state to set (true = done, false = open again)."

      field :manual_task, Types::ManualTaskType,
            null: false,
            description: "The toggled task (itself on a same-state toggle)."

      def resolve(id:, done:)
        command_result(::Progress::SetManualTaskDoneCommand.call(
          current_user: current_user!,
          id: id,
          done: done
        ))
      end
    end
  end
end

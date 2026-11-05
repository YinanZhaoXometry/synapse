# frozen_string_literal: true

module Mutations
  module Hubs
    # The manual-task delete op (FR-27, epic P2-09 T3) — thin per AD-12:
    # authorize (current_user!) → command → map. The row-only delete (no
    # dependents) and the uniform NOT_FOUND matrix live in
    # ::Progress::DeleteManualTaskCommand.
    class DeleteManualTask < BaseMutation
      description "Delete a manual task from the 今日学习 list (FR-27) — the row goes, nothing else (a manual task has no dependents). Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The manual task's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      field :deleted_manual_task_id, String,
            null: false,
            description: "The deleted task's uuid — for client cache eviction."

      def resolve(id:)
        command_result(::Progress::DeleteManualTaskCommand.call(current_user: current_user!, id: id))
      end
    end
  end
end

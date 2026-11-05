# frozen_string_literal: true

module Mutations
  module Hubs
    # The manual-task add op (FR-27, epic P2-09 T3) — thin per AD-12:
    # authorize (current_user!) → command → map. The title bound and the
    # dueDate normalization (a plain date or null) live in
    # ::Progress::AddManualTaskCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class AddManualTask < BaseMutation
      description "Add a manual task to the 今日学习 list (FR-27). The title is required and bounded at 200 characters (VALIDATION_FAILED beyond); the dueDate is a plain date or null — the day is the fact. The row is user-scoped (AD-13)."

      argument :title, String,
               required: true,
               description: "What the user wrote. Blank (whitespace-only) or beyond 200 characters is VALIDATION_FAILED."

      argument :due_date, Types::DateTime,
               required: false,
               description: "The task's target day (a plain date is fine — it lands as that day; null leaves the task unscheduled)."

      field :manual_task, Types::ManualTaskType,
            null: false,
            description: "The created task."

      def resolve(title:, due_date: nil)
        command_result(::Progress::AddManualTaskCommand.call(
          current_user: current_user!,
          title: title,
          due_date: due_date
        ))
      end
    end
  end
end

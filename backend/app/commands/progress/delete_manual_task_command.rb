# frozen_string_literal: true

module Progress
  # The 今日学习 manual-task delete op (FR-27, epic P2-09 T3): the row goes,
  # nothing else — a manual task has no dependents (no cascade, unlike the
  # plan delete). Addressing follows the house NOT_FOUND matrix (AD-13):
  # unknown, foreign, and malformed ids answer uniformly NOT_FOUND.
  class DeleteManualTaskCommand < ApplicationCommand
    option :current_user
    option :id

    def call
      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "manual task not found" })
      end

      task = current_user.manual_tasks.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "manual task not found" }) unless task

      task.delete
      Success(deleted_manual_task_id: task.id)
    end
  end
end

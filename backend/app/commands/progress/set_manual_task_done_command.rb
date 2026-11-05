# frozen_string_literal: true

module Progress
  # The 今日学习 manual-task completion toggle (FR-27, epic P2-09 T3): the
  # write half T1 deferred. Idempotent by law — toggling to the state the row
  # already carries returns the row UNCHANGED (no write, updated_at
  # untouched: no phantom activity on a double-tap or an offline replay).
  # Addressing follows the house NOT_FOUND matrix (AD-13): unknown, foreign,
  # and malformed ids answer uniformly NOT_FOUND — a malformed address must
  # not degrade into an INTERNAL from the uuid column comparison.
  class SetManualTaskDoneCommand < ApplicationCommand
    option :current_user
    option :id
    option :done

    def call
      unless [ true, false ].include?(done)
        return Failure(:VALIDATION_FAILED, { message: "done must be a boolean", field: :done })
      end

      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "manual task not found" })
      end

      task = current_user.manual_tasks.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "manual task not found" }) unless task

      return Success(manual_task: task) if task.done == done

      task.update!(done: done)
      Success(manual_task: task)
    end
  end
end

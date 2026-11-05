# frozen_string_literal: true

# Validates the manual_tasks user foreign key added NOT VALID in
# CreateManualTasks (the notes/requeue two-step pattern).
class ValidateManualTasksUserFk < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :manual_tasks, :users
  end
end

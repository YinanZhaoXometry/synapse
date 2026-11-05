# frozen_string_literal: true

# Validates the users_weekly_goal_target_check constraint added NOT VALID in
# AddWeeklyGoalTargetToUsers (strong_migrations' two-step pattern).
class ValidateWeeklyGoalTargetCheck < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :users, name: "users_weekly_goal_target_check"
  end
end

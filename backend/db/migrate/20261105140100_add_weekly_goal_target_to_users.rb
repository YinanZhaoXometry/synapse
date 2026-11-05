# frozen_string_literal: true

# The weekly goal's home (epic P2-09 T1, delta decision 3): the target is a
# per-user setting — evidence-producing SESSIONS per ISO week (SM-C3:
# sessions, never minutes). Plain column (no FKs); the range 1..21 is pinned
# twice — the DB check floor here (added NOT VALID per strong_migrations,
# validated in ValidateWeeklyGoalTargetCheck), server-side validation in
# Progress::SetWeeklyGoalCommand.
class AddWeeklyGoalTargetToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :weekly_goal_target, :integer, null: false, default: 3
    add_check_constraint :users, "weekly_goal_target BETWEEN 1 AND 21",
                         name: "users_weekly_goal_target_check", validate: false
  end
end

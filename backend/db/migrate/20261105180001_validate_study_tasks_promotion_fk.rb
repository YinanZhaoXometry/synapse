# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the standing
# pattern): validate the promotion FK that 20261105180000 added as
# validate: false.
class ValidateStudyTasksPromotionFk < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :study_tasks, :study_plans, column: :promoted_plan_id
  end
end

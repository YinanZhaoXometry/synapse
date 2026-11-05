# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the standing
# pattern): validate the self-referential fork-attribution FK that
# 20261105150000 added as validate: false.
class ValidateStudyPlansForkFk < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :study_plans, :study_plans, column: :forked_from_plan_id
  end
end

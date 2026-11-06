# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the
# study_focus_sets/notes precedents): validate the three FKs the create
# migration added as validate: false — user, plan, node.
class ValidateTodaySuggestionsFks < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :today_suggestions, :users
    validate_foreign_key :today_suggestions, :study_plans, column: :plan_id
    validate_foreign_key :today_suggestions, :knowledge_nodes, column: :node_id
  end
end

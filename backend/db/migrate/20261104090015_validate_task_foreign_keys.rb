# frozen_string_literal: true

# Validates the two mutual-reference FKs added NOT VALID in CreateStudyTasks
# (strong_migrations posture: validate in a separate migration). Both tables
# are brand new, so validation is instant.
class ValidateTaskForeignKeys < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :knowledge_nodes, :study_tasks
    validate_foreign_key :materials, :study_tasks
  end
end

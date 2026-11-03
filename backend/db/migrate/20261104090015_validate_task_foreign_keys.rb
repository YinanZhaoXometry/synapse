# frozen_string_literal: true

# Validates the two mutual-reference FKs added NOT VALID in CreateStudyTasks
# (strong_migrations posture: validate in a separate migration). Both tables
# are brand new, so validation is instant.
#
# `up`/`down` instead of `change`: Rails 8.1's CommandRecorder has no
# invert_validate_foreign_key, so a `def change` here would make `db:rollback`
# at head raise IrreversibleMigration. Un-validating is not supported anyway —
# this migration pair was validated-only (CreateStudyTasks added the FKs NOT
# VALID; this one flips them valid), so `down` is a deliberate no-op.
class ValidateTaskForeignKeys < ActiveRecord::Migration[8.1]
  def up
    validate_foreign_key :knowledge_nodes, :study_tasks
    validate_foreign_key :materials, :study_tasks
  end

  def down; end
end

# frozen_string_literal: true

# Validates the Solid Queue FKs added NOT VALID in
# AddSolidQueueForeignKeys (strong_migrations posture: validate in a separate
# migration). Both tables are brand new, so validation is instant.
#
# `up`/`down` instead of `change`: Rails 8.1's CommandRecorder has no
# invert_validate_foreign_key, so a `def change` here would make `db:rollback`
# at head raise IrreversibleMigration (20261104090015's precedent verbatim).
# Un-validating is not supported anyway — this pair was validated-only.
class ValidateSolidQueueForeignKeys < ActiveRecord::Migration[8.1]
  JOB_TABLES = %w[
    solid_queue_batch_executions
    solid_queue_blocked_executions
    solid_queue_claimed_executions
    solid_queue_failed_executions
    solid_queue_ready_executions
    solid_queue_recurring_executions
    solid_queue_scheduled_executions
  ].freeze

  def up
    JOB_TABLES.each { |table| validate_foreign_key table, "solid_queue_jobs" }
    validate_foreign_key "solid_queue_batch_executions", "solid_queue_batches"
  end

  def down
    # no-op: validation-only (see the class comment)
  end
end

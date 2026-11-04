# frozen_string_literal: true

# The Solid Queue execution tables' FKs to solid_queue_jobs (AD-19, epic P2-7
# ticket 01), added NOT VALID per the strong_migrations posture — the split
# from CreateSolidQueueTables follows 20261104090015's precedent (adding an
# FK blocks writes on both tables; validate separately). The tables are
# brand new, so validation in the follow-up is instant.
class AddSolidQueueForeignKeys < ActiveRecord::Migration[8.1]
  JOB_TABLES = %w[
    solid_queue_batch_executions
    solid_queue_blocked_executions
    solid_queue_claimed_executions
    solid_queue_failed_executions
    solid_queue_ready_executions
    solid_queue_recurring_executions
    solid_queue_scheduled_executions
  ].freeze

  def change
    JOB_TABLES.each do |table|
      add_foreign_key table, "solid_queue_jobs", column: "job_id", on_delete: :cascade, validate: false
    end
    add_foreign_key "solid_queue_batch_executions", "solid_queue_batches", column: "batch_id",
                    on_delete: :cascade, validate: false
  end
end

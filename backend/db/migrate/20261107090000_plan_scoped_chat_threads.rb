# frozen_string_literal: true

# Plan-scoped Companion threads (epic-25 T1, spec decisions 1–2): the tutor
# page's plan-grounded chat persists with the same shape as the reader's
# material thread. `chat_threads` gains nullable `plan_id`; `material_id`
# relaxes to nullable; a CHECK constraint enforces the exactly-one scope
# (the DB floor over the model's mirror validation); the unique index on
# `plan_id` mirrors the material one (the thread is 1:1 per scope — the
# append's savepoint race backstop leans on it; multiple NULLs are legal in
# PG, so the material side's index keeps coexisting).
#
# strong_migrations two-step dance (the standing pattern — the promotion
# precedent): the FK + CHECK added validate: false here, validated by
# ValidatePlanScopedChatThreadsConstraints; the FK's index built
# concurrently (existing table).
class PlanScopedChatThreads < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :chat_threads, :plan_id, :uuid
    change_column_null :chat_threads, :material_id, true

    add_index :chat_threads, :plan_id, unique: true, algorithm: :concurrently
    add_foreign_key :chat_threads, :study_plans, column: :plan_id, validate: false
    add_check_constraint :chat_threads,
                         "(material_id IS NOT NULL AND plan_id IS NULL) " \
                         "OR (material_id IS NULL AND plan_id IS NOT NULL)",
                         name: "chat_threads_one_scope", validate: false
  end
end

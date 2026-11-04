# frozen_string_literal: true

# The per-user daily AI call counter (AD-16/FR-34, epic P2-5 ticket 02 —
# assumption A1): one row per user per UTC day, incremented by
# Ai::DailyCap.consume! at the Ai::Provider seam before every provider call.
# Api-local table on the same Postgres (A1) — not a spine ER entity; the
# midnight-UTC day boundary is the streak convention.
#
# The counter is deliberately over-counting by design (AD-16): a stream
# restart after a drop mints a fresh ticket and restarts the generation, and
# that second call counts like the first.
class CreateAiUsageCounters < ActiveRecord::Migration[8.1]
  def change
    create_table :ai_usage_counters, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.date :day, null: false
      t.integer :call_count, null: false, default: 0

      t.timestamps

      t.index %i[user_id day], unique: true, name: "index_ai_usage_counters_on_user_id_and_day"
    end

    add_foreign_key :ai_usage_counters, :users, validate: false
  end
end

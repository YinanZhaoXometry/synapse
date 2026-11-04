# frozen_string_literal: true

# The re-queue schedule side table (AD-19/FR-24, epic P2-7 ticket 02 —
# kickoff decision 7): ONE mechanism covering mistakes and flashcards
# (polymorphic schedulable), materialized by Requeue::ScanDueItemsCommand's
# correct-on-wake recompute. Deliberately NOT columns on the two entities
# (no ER sprawl; epic-10's adaptive scheduling gets a home here).
#
# The rows are a derivable cache: stage + next_due_at are always recomputed
# from the source rows' timestamps at scan time — never accumulated while
# asleep (a multi-day gap re-derives cleanly, no backlog inflation). The
# unique [item_type, item_id] index backs the scan's upsert; [user_id,
# next_due_at] serves epic-09's Today-hub read (due items for a day, per
# user — UTC day boundary per the streak convention).
class CreateRequeueSchedules < ActiveRecord::Migration[8.1]
  def change
    create_table :requeue_schedules, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.string :schedulable_type, null: false
      t.uuid :schedulable_id, null: false
      t.integer :stage, null: false, default: 0
      t.datetime :next_due_at, null: false
      t.datetime :last_source_timestamp, null: false

      t.timestamps

      t.index %i[schedulable_type schedulable_id], unique: true,
              name: "index_requeue_schedules_on_schedulable_uniqueness"
      t.index %i[user_id next_due_at], name: "index_requeue_schedules_on_user_id_and_next_due_at"
      t.index :next_due_at
    end

    add_foreign_key :requeue_schedules, :users, validate: false
  end
end

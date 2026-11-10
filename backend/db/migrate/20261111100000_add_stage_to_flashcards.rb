# frozen_string_literal: true

# Epic-31 T2: the flashcard's ladder stage — the ONE new persisted state this
# epic adds. Maintained exclusively by rateFlashcard (an easy streak climbs,
# hard resets, medium holds — the Q7 cliff-free rule); the requeue scan reads
# it to index the per-difficulty geometric ladders. Fresh cards start at 0;
# pre-upgrade cards re-earn their rungs at the next rating (there is no
# rating history to backfill from). The check constraint validates in the
# follow-up migration (strong-migrations two-step).
class AddStageToFlashcards < ActiveRecord::Migration[8.1]
  def change
    add_column :flashcards, :stage, :integer, null: false, default: 0
    add_check_constraint :flashcards, "stage >= 0", name: "flashcards_stage_check", validate: false
  end
end

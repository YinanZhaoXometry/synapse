# frozen_string_literal: true

# The mistake-lifecycle flag (epic-18 T1, spec decision 4): user-marked,
# default false, toggles both ways — the mistakes hub becomes a queue the
# owner works down instead of an append-only log. No auto-resolve by later
# correct answers (a correct answer elsewhere is not a review); forfeited
# entries resolve like any other. Display/lifecycle only — nothing reads it
# into Mastery or targeting (AD-6/ADR-0001 fence; the targeting bonus's
# any-entry ruling is annotated at Ai::TargetingCandidates).
class AddResolvedToMistakeEntries < ActiveRecord::Migration[8.1]
  def change
    add_column :mistake_entries, :resolved, :boolean, null: false, default: false
  end
end

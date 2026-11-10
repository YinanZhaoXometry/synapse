# frozen_string_literal: true

# One materialized due-date for a mistake or a flashcard (AD-19/FR-24, epic
# P2-7 ticket 02 — kickoff decision 7). A derivable cache, not source truth:
# Requeue::ScanDueItemsCommand recomputes stage + next_due_at from the
# source rows' timestamps on every wake (correct-on-wake — never accumulated
# while asleep) and prunes rows whose source has vanished. The polymorphic
# `schedulable` is deliberately optional at the model seam: a source row can
# be deleted between scans, and the schedule must survive that instant long
# enough for the next scan to prune it (there is no DB FK to polymorphic
# targets anyway).
class RequeueSchedule < ApplicationRecord
  belongs_to :user
  belongs_to :schedulable, polymorphic: true, optional: true

  # The review queue's order (epic-31 T3), shared by the dueItems query and
  # the Today hub's due slice: due date ascending — an overdue item
  # resurfaces first — with same-instant ties breaking MISTAKES before
  # flashcards (the known weak spot gets the freshest attention; the
  # discrete form of DeepTutor's active-error bonus, comparison §3.7), then
  # id for determinism.
  scope :review_order, -> {
    order(Arel.sql(<<~SQL.squish))
      next_due_at ASC,
      CASE WHEN schedulable_type = 'MistakeEntry' THEN 0 ELSE 1 END ASC,
      schedulable_id ASC
    SQL
  }
end

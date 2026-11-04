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
end

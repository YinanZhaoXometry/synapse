# frozen_string_literal: true

module Requeue
  # Recompute the re-queue schedule for every mistake and flashcard (FR-24,
  # epic P2-7 ticket 02 lands the algorithm; ticket 01 ships the recurring
  # shape — kickoff decision 6: no throwaway smoke job, the recurring entry
  # points here from the start and the command grows into the scan).
  #
  # The contract this command grows into (kickoff decision 7): due-ness is
  # RECOMPUTED from source rows' timestamps on every wake (correct-on-wake,
  # AD-19) and materialized into requeue_schedules — stage + next_due_at are
  # never accumulated while asleep, so a multi-day gap re-derives cleanly
  # with no backlog inflation. Interval ladders live in kickoff decision 8.
  class ScanDueItemsCommand < ApplicationCommand
    # The command is user-less (the wake serves every user) — no current_user
    # option, so #authorize's default allow stands (there is nobody to
    # authorize; a system-shaped command like System::PingCommand).
    def call
      Success(due_count: 0, scanned_at: Time.current)
    end
  end
end

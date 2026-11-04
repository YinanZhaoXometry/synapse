# frozen_string_literal: true

module Requeue
  # The FR-24 re-queue due scan's wake entry (AD-19, epic P2-7 ticket 01) —
  # the ONE named recurring job (config/recurring.yml, every 10 minutes).
  # Thin per AD-12: no decisions here, the wake goes straight to
  # ScanDueItemsCommand, which recomputes due-ness from source timestamps
  # (correct-on-wake — never accumulated while asleep).
  class ScanJob < ApplicationJob
    def perform
      Requeue::ScanDueItemsCommand.call
    end
  end
end

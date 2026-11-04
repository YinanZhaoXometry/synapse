# frozen_string_literal: true

module Requeue
  # The FR-24 re-queue due scan's wake entry (AD-19, epic P2-7 ticket 01) —
  # the ONE named recurring job (config/recurring.yml, every 10 minutes).
  # Thin per AD-12: no decisions here, the wake goes straight to
  # ScanDueItemsCommand, which recomputes due-ness from source timestamps
  # (correct-on-wake — never accumulated while asleep).
  #
  # The one non-thin line is failure observability (review round 1):
  # ApplicationCommand converts infra exceptions into Failure VALUES, so a
  # bare `command.call` would return normally and Solid Queue would record a
  # SUCCESSFUL run while dueItems silently staled forever. A failed wake is
  # logged and reported (Rails.error) so it surfaces in Render's logs /
  # error reporting; retries stay off (AD-19) — the next wake recomputes
  # everything, so the failure only has to be visible.
  class ScanJob < ApplicationJob
    def perform
      result = Requeue::ScanDueItemsCommand.call
      return result if result.success?

      message = "re-queue scan failed: #{result.failure.code} #{result.failure.context[:message]}"
      Rails.logger.error(message)
      # Rails.error wants a real Exception (the command's Failure is a value,
      # by design — AD-12); wrap it so error reporters see the wake's
      # failure, then raise so Solid Queue records the failed execution.
      error = StandardError.new(message)
      Rails.error.report(error, handled: true, context: { job: self.class.name })

      raise error
    end
  end
end

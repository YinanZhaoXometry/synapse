# frozen_string_literal: true

# The Active Job base (AD-19, epic P2-7 ticket 01): jobs are THIN wrappers
# that load what they need and call a command — every decision lives in the
# command layer (AD-12), the job only wires the wake to it. The adapter is
# Solid Queue, running in-process with puma (the SOLID_QUEUE_IN_PUMA-gated
# plugin in config/puma.rb); test env keeps the :test adapter — jobs are
# tested directly, never through a booted supervisor.
class ApplicationJob < ActiveJob::Base
  # No automatic retries for the recurring scan (the only job v1 has): a
  # failed wake retries at the NEXT scheduled wake — the scan recomputes
  # everything from source timestamps then, so a missed/mid-failed pass
  # leaves nothing half-written that needs repair (correct-on-wake, AD-19).
  # Per-job overrides when a second job ever lands.
  queue_as :default
end

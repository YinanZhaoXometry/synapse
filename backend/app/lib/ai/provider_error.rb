# frozen_string_literal: true

module Ai
  # Transport-level failure against the AI provider (epic P2-5 ticket 01):
  # connection refused, timeout, non-200 response, or an error payload
  # arriving mid-stream. Infrastructure, not a domain outcome — the
  # Ai::Provider seam is the only place these are raised, and it converts
  # them into `Failure(:INTERNAL, …)` values so no command ever sees an
  # exception (AD-12: business logic never raises).
  class ProviderError < StandardError; end
end

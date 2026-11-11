# frozen_string_literal: true

module Ai
  # Transport-level failure against the AI provider (epic P2-5 ticket 01):
  # connection refused, timeout, non-200 response, or an error payload
  # arriving mid-stream. Infrastructure, not a domain outcome — the
  # Ai::Provider seam is the only place these are raised, and it converts
  # them into `Failure(:INTERNAL, …)` values so no command ever sees an
  # exception (AD-12: business logic never raises).
  #
  # `detail` is the fault class (epic-34 T1): one of :rate_limited |
  # :timeout | :unreachable | :unparseable, stamped by GlmClient at each
  # raise site and carried into the seam's Failure context — the
  # GraphQL-facing failure codes never change (transport stays INTERNAL +
  # context.detail; CAP_REACHED keeps its own code). nil = unclassified:
  # the seam's bounded auto-retry never touches an unknown class.
  class ProviderError < StandardError
    attr_reader :detail

    def initialize(message, detail: nil)
      super(message)
      @detail = detail
    end
  end
end

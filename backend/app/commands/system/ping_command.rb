# frozen_string_literal: true

module System
  # Demo command — the AD-12 pattern exemplar, deliberately trivial and
  # health-adjacent. Shows the ApplicationCommand contract end to end:
  # dry-initializer option in, typed Failure for a domain outcome, Success
  # payload out. It is NOT in the GraphQL schema (the schema stays
  # health-only); RSpec calls it directly (AD-10).
  class PingCommand < ApplicationCommand
    option :message, default: proc { "pong" }

    def call
      Success(pong: message)
    end
  end
end

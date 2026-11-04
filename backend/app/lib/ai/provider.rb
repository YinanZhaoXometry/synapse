# frozen_string_literal: true

module Ai
  # The provider seam (AD-16, epic P2-5 ticket 01): the one object every AI
  # surface touches. Resolves configuration from ENV at call time (AD-12
  # posture, no settings gem — defaults overridable, garbage falls back),
  # builds the OpenAI-compatible client, and maps transport failures
  # (Ai::ProviderError) into `Failure(:INTERNAL)` values so the command layer
  # never sees an exception.
  #
  # Stub-ability contract (ticket 01, no live calls in CI): specs override
  # `.adapter`, never the transport. `Ai::GlmClient` itself is exercised
  # against a local stub HTTP server, not a live provider. The per-user
  # daily cost cap (ticket 02, FR-34) will be enforced inside `.complete` /
  # `.stream` — at this boundary, before any HTTP leaves the process,
  # counting every call including a stream restart after a drop (AD-16).
  module Provider
    extend Dry::Monads[:result]

    DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
    DEFAULT_MODEL = "glm-4-flash"
    DEFAULT_TIMEOUT_SECONDS = 120

    class << self
      # Resolve the full client configuration; `api_key` stays blank when
      # unset (dev/test pre-cutover), and `configured?` answers whether real
      # calls are possible. Garbage timeouts fall back to the default.
      def configuration
        {
          base_url: ENV["PROVIDER_BASE_URL"].to_s.strip.presence || DEFAULT_BASE_URL,
          api_key: ENV["PROVIDER_KEY"].to_s.strip,
          model: ENV["PROVIDER_MODEL"].to_s.strip.presence || DEFAULT_MODEL,
          timeout_seconds: positive_int(ENV["PROVIDER_TIMEOUT_SECONDS"]) || DEFAULT_TIMEOUT_SECONDS
        }
      end

      def configured?
        configuration[:api_key].present?
      end

      def adapter
        GlmClient.new(**configuration)
      end

      # One full completion: Success(String) with the raw assistant text, or
      # Failure(:INTERNAL) when the provider is unconfigured, unreachable, or
      # returns something unusable.
      def complete(messages)
        dispatch { |client| client.complete(messages) }
      end

      # Token deltas as a lazy Enumerator wrapped in a Result: Success holds
      # the enumerator, whose deltas arrive as pulled; transport faults raise
      # at pull time, inside the consumer's rescue region — the SSE endpoint
      # turns them into a `terminal` event.
      def stream(messages)
        dispatch { |client| client.stream(messages) }
      end

      private

      def dispatch
        unless configured?
          return Failure(ApplicationErrors::Failure.new(
            code: :INTERNAL, context: { message: "ai provider not configured (PROVIDER_KEY blank)" }
          ))
        end

        Success(yield adapter)
      rescue ProviderError => e
        Failure(ApplicationErrors::Failure.new(
          code: :INTERNAL, context: { message: "ai provider call failed: #{e.message}" }
        ))
      end

      def positive_int(raw)
        value = raw.to_s.strip.to_i
        value if value.positive?
      end
    end
  end
end

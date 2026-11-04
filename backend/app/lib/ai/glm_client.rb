# frozen_string_literal: true

require "net/http"
require "json"

module Ai
  # OpenAI-compatible chat-completions transport (AD-16, epic P2-5 ticket 01),
  # pointed at GLM by default configuration — a provider swap is config, not
  # code. Transport only: it knows the wire format, not the domain. Prompts,
  # context assembly, and response-contract parsing live in the commands and
  # the assembler, never here.
  #
  # Stdlib Net::HTTP, zero new deps (kickoff delta 3). Streaming is
  # block-consumption of the upstream SSE via read_body: `.stream` returns a
  # lazy Enumerator of content deltas, so the SSE controller can forward each
  # delta as it arrives. Every transport fault raises Ai::ProviderError —
  # including a non-200 status or an error payload surfacing mid-stream — and
  # the error escapes lazily, on first pull of the enumerator, which is what
  # lets the stream controller turn it into a `terminal` event.
  class GlmClient
    # SSE wire details shared with the parser below. OpenAI-compatible
    # providers emit `data: <json>` lines, a final `data: [DONE]`, and may
    # fragment a JSON object across TCP chunks — the buffer never parses a
    # partial line.
    DATA_PREFIX = "data:"
    DONE_SENTINEL = "[DONE]"
    CHAT_COMPLETIONS_PATH = "/chat/completions"

    attr_reader :model

    def initialize(base_url:, api_key:, model:, timeout_seconds:)
      @request_uri = URI(base_url.to_s.strip.chomp("/") + CHAT_COMPLETIONS_PATH)
      @api_key = api_key.to_s
      @model = model
      @timeout_seconds = timeout_seconds
    end

    # One full completion (the non-streamed mutations' path — quiz/flashcard
    # generation, grading per A2/AD-16). Returns the assistant message text.
    def complete(messages)
      http = build_http
      request = build_request(messages, stream: false)
      response = http.start { |connection| connection.request(request) }
      raise ProviderError, "provider returned HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)

      parse_completion(response.body)
    rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, SocketError, OpenSSL::SSL::SSLError => e
      raise ProviderError, "provider transport failure: #{e.class}: #{e.message}"
    end

    # Token deltas as a lazy Enumerator (the SSE endpoint's upstream). The
    # HTTP connection opens on first pull; every transport fault raises
    # Ai::ProviderError AT PULL TIME — the rescue lives INSIDE the
    # Enumerator block, because the block executes lazily outside this
    # method's own rescue region (a mid-stream read timeout or connection
    # reset must still surface as the typed error the seam's contract
    # promises, not as a raw Net:: exception).
    def stream(messages)
      Enumerator.new do |yielder|
        begin
          http = build_http
          request = build_request(messages, stream: true)
          buffer = SseBuffer.new
          http.start do |connection|
            connection.request(request) do |response|
              unless response.is_a?(Net::HTTPSuccess)
                raise ProviderError, "provider returned HTTP #{response.code}"
              end

              response.read_body do |chunk|
                buffer.feed(chunk).each { |delta| yielder << delta }
              end
            end
          end
          buffer.flush.each { |delta| yielder << delta }
        rescue ProviderError
          raise
        rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET,
               Errno::EPIPE, IOError, EOFError, SocketError, OpenSSL::SSL::SSLError => e
          raise ProviderError, "provider transport failure: #{e.class}: #{e.message}"
        end
      end
    end

    private

    def build_http
      http = Net::HTTP.new(@request_uri.host, @request_uri.port)
      http.use_ssl = @request_uri.scheme == "https"
      http.open_timeout = @timeout_seconds
      http.read_timeout = @timeout_seconds
      http
    end

    def build_request(messages, stream:)
      Net::HTTP::Post.new(@request_uri).tap do |request|
        request["Content-Type"] = "application/json"
        request["Authorization"] = "Bearer #{@api_key}"
        request.body = JSON.generate(model: @model, messages: messages, stream: stream)
      end
    end

    def parse_completion(raw)
      payload = JSON.parse(raw)
      if payload.is_a?(Hash) && payload["error"]
        raise ProviderError, "provider error payload: #{payload["error"].to_s[0, 200]}"
      end

      choices = payload.is_a?(Hash) ? payload["choices"] : nil
      content = choices.is_a?(Array) ? choices.dig(0, "message", "content") : nil
      raise ProviderError, "provider response missing choices[0].message.content" if content.nil?

      content
    rescue JSON::ParserError
      raise ProviderError, "provider returned a non-JSON completion body"
    end

    # Incremental SSE line buffer: `feed` takes a raw TCP chunk, extracts
    # every content delta from the complete `data:` lines it closes, and
    # keeps the trailing partial line for the next feed. `[DONE]` and
    # keep-alive/comment lines produce nothing; a JSON line that fails to
    # parse — or that carries an error object — raises ProviderError (error)
    # or is skipped (noise), never silently mis-parsed as content.
    class SseBuffer
      def initialize
        @pending = +""
        @pending_error = nil
      end

      def feed(chunk)
        # An error line seen in an earlier chunk raises first — deltas the
        # same chunk buffered have already been handed out.
        raise(@pending_error) if @pending_error

        @pending << chunk.to_s
        deltas = []
        while (line_end = @pending.index("\n"))
          line = @pending.slice!(0..line_end)
          begin
            deltas.concat(consume_line(line.chomp))
          rescue ProviderError => e
            # Defer: deltas buffered before the error line in THIS chunk go
            # out first; the error fires on the next pull.
            @pending_error = e
            break
          end
        end
        deltas
      end

      # A provider that closes the stream mid-line (no trailing newline):
      # flush whatever complete data payload is still pending.
      def flush
        raise(@pending_error) if @pending_error

        line = @pending
        @pending = +""
        consume_line(line.chomp)
      end

      private

      def consume_line(line)
        return [] unless line.start_with?(GlmClient::DATA_PREFIX)

        payload = line.delete_prefix(GlmClient::DATA_PREFIX).strip
        return [] if payload.empty? || payload == GlmClient::DONE_SENTINEL

        parsed = JSON.parse(payload)
        if parsed.is_a?(Hash) && parsed["error"]
          raise ProviderError, "provider stream error payload: #{parsed["error"].to_s[0, 200]}"
        end

        content = parsed.dig("choices", 0, "delta", "content")
        content.is_a?(String) ? [ content ] : []
      rescue JSON::ParserError
        []
      end
    end
  end
end

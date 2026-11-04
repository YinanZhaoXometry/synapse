# frozen_string_literal: true

module Ai
  # The proposal-reply splitter (ticket 04's frozen tag contract): the
  # model's proposal reply carries a readable outline between
  # <outline>…</outline> and the strict proposal JSON between
  # <proposal>…</proposal>. Feed it the raw token deltas as they arrive; it
  # returns ONLY the outline text as token events (what the client streams
  # — the JSON never reaches the token wire), and `finish` parses the
  # proposal JSON for the terminal event.
  #
  # Tag-safe streaming: a tag can arrive split across deltas, so the
  # streaming phase always holds back HOLD characters (the longest tag minus
  # one) — a partial "</outline>" prefix is never emitted as a token. Any
  # contract violation (tags missing, JSON unparseable) degrades to
  # `finish` returning proposal: nil — the controller turns that into a
  # terminal INTERNAL; the outline already streamed is lost with the failed
  # generation (the client restarts, cap-counted, per AD-16).
  class TaggedReplySplitter
    OUTLINE_OPEN = "<outline>"
    OUTLINE_CLOSE = "</outline>"
    PROPOSAL_OPEN = "<proposal>"
    PROPOSAL_CLOSE = "</proposal>"
    HOLD = [ OUTLINE_OPEN, OUTLINE_CLOSE, PROPOSAL_OPEN, PROPOSAL_CLOSE ].map(&:length).max - 1

    def initialize
      @buffer = +""
      @tail = +""
      @phase = :seeking_outline
      @leading_newline_pending = true
    end

    # Returns the token events (outline text pieces) the delta produced.
    def feed(delta)
      @buffer << delta.to_s
      case @phase
      when :seeking_outline
        if (index = @buffer.index(OUTLINE_OPEN))
          @buffer = @buffer[(index + OUTLINE_OPEN.length)..].to_s
          @phase = :streaming_outline
          emit_streamable
        else
          # Hold everything back — the outline tag may still arrive split.
          []
        end
      when :streaming_outline
        emit_streamable
      else
        # :collecting_proposal — everything after the outline closes feeds
        # the proposal tail (the JSON may still be arriving).
        @tail << delta.to_s
        []
      end
    end

    # {proposal: hash-or-nil} — the parsed proposal JSON, nil on any
    # contract violation. Call exactly once, after the last delta.
    def finish
      { proposal: parse_proposal }
    end

    private

    def emit_streamable
      # Suppress the outline's leading newline once — but only when the
      # buffer is non-empty (the newline may still arrive in a later delta
      # when the open tag closed a buffer exactly).
      if @leading_newline_pending && !@buffer.empty?
        @buffer = @buffer.delete_prefix("\r").delete_prefix("\n")
        @leading_newline_pending = false
      end
      if (index = @buffer.index(OUTLINE_CLOSE))
        chunk = @buffer[0...index]
        @tail = @buffer[(index + OUTLINE_CLOSE.length)..].to_s
        @buffer = +""
        @phase = :collecting_proposal
        chunk.empty? ? [] : [ chunk ]
      else
        emit_length = @buffer.length - HOLD
        return [] unless emit_length.positive?

        [ @buffer.slice!(0, emit_length) ]
      end
    end

    def parse_proposal
      return nil unless @phase == :collecting_proposal

      opening = @tail.index(PROPOSAL_OPEN)
      closing = @tail.index(PROPOSAL_CLOSE)
      return nil unless opening && closing && closing > opening

      JSON.parse(@tail[(opening + PROPOSAL_OPEN.length)...closing])
    rescue JSON::ParserError
      nil
    end
  end
end

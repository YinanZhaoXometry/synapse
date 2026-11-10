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
      @raw = +""
      @buffer = +""
      @tail = +""
      @phase = :seeking_outline
      @leading_newline_pending = true
    end

    # Returns the token events (outline text pieces) the delta produced.
    def feed(delta)
      @raw << delta.to_s
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

    # The raw reply's tail for the controller's failure log (diagnosability —
    # the parse itself is silent by contract). Public: the controller reads it
    # on the nil-proposal path — the untouched raw reply, whatever phase the
    # stream died in.
    def reply_tail
      @raw.last(400)
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
      # The salvage source is the RAW reply (@raw), not the phase buffers:
      # a model that dropped a wrapper tag (no <outline>, no </outline>, or
      # no </proposal> — all 2026-11-10 live failure classes) scatters the
      # proposal across phases, and a generation that succeeded on the wire
      # must not die on a missing wrapper. The open tag is the anchor: parse
      # from it to the reply's end (the tolerant ladder strips whatever
      # trails the JSON). No tags at all → the whole reply rides the ladder
      # (bare JSON / fenced / prose-wrapped); nothing salvageable → nil.
      span = tag_span(@raw)
      return parse_segment(@raw[span...]) if span
      return nil if @phase == :collecting_proposal

      parse_segment(@raw)
    end

    # The span after <proposal> (the CLOSE tag is optional — a truncated
    # reply often ends right after the JSON), or nil when the open tag is
    # absent.
    def tag_span(text)
      opening = text.index(PROPOSAL_OPEN)
      opening ? opening + PROPOSAL_OPEN.length : nil
    end

    # The tolerant parse ladder (2026-11-10): strict first, then the
    # recoverable contract misses in the order the live model produced them —
    # markdown code fences around the JSON, prose riding before/after it, and
    # unescaped ASCII quotes INSIDE string values (the second live failure:
    # "聊"天不等于工程 — a content quote the model never escaped). Each rung
    # is a candidate parse; the first that parses wins. Structurally
    # corrupted JSON still fails (nil; the controller logs the tail and
    # answers terminal INTERNAL).
    def parse_segment(segment)
      stripped = segment.gsub(/```(?:json)?/i, "").strip
      first = stripped.index("{")
      last = stripped.rindex("}")
      sliced = first && last && last > first ? stripped[first..last] : nil
      candidates = [
        stripped,
        repair_unescaped_quotes(stripped),
        sliced,
        sliced && repair_unescaped_quotes(sliced)
      ].compact
      candidates.each do |candidate|
        begin
          return JSON.parse(candidate)
        rescue JSON::ParserError
          nil
        end
      end
      nil
    end

    # Escape double quotes that are CONTENT inside string values: a quote
    # closes a string only when the next non-space character is a JSON
    # delimiter (: , } ] or end); any other in-string quote is model noise
    # and gets escaped. A misjudgment breaks the parse — the ladder just
    # falls through to the next rung, never worse than before.
    def repair_unescaped_quotes(segment)
      chars = segment.chars
      out = +""
      in_string = false
      i = 0
      while i < chars.length
        ch = chars[i]
        if in_string && ch == "\\"
          out << ch << (chars[i + 1] || "")
          i += 2
          next
        end
        if ch == "\""
          if in_string
            j = i + 1
            j += 1 while chars[j] == " " || chars[j] == "\n" || chars[j] == "\t" || chars[j] == "\r"
            if j >= chars.length || [ ":", ",", "}", "]" ].include?(chars[j])
              in_string = false
              out << ch
            else
              out << "\\\""
            end
            i += 1
            next
          end
          in_string = true
        end
        out << ch
        i += 1
      end
      out
    end
  end
end

# frozen_string_literal: true

module Ai
  # Model-reply parsing (epic P2-5 ticket 03): the one place that extracts a
  # JSON object from a provider reply. Models wrap JSON in prose or code
  # fences despite the prompt, so the extraction is a string-aware balanced
  # scan: from the first `{`, tracking depth and skipping string literals,
  # up to the matching `}`. Returns the JSON STRING or nil — the callers own
  # schema validation (an extracted object that fails the schema is the
  # INTERNAL path, not a silent accept).
  #
  # Repair layer (epic-34 T1): when the balanced scan yields no parseable
  # candidate, two mechanical repairs get one chance before nil — truncated-
  # tail completion (close the open string, then the open braces/brackets) and
  # trailing-comma removal — then re-validate. The order is fixed: balanced
  # scan → repair candidates → nil. Repair never invents content: a tail that
  # still does not parse stays nil, and a clean extraction is returned
  # untouched (repair only fires on failure).
  module ResponseParser
    module_function

    def extract_json_object(raw)
      text = raw.to_s
      start = text.index("{")
      return nil unless start

      candidate = balanced_candidate(text, start)
      pool = candidate ? [ candidate, *repair_candidates(candidate) ] : repair_candidates(text[start..])
      pool.find { |repaired| valid_json?(repaired) }
    end

    def valid_json?(string)
      JSON.parse(string)
      true
    rescue JSON::ParserError
      false
    end

    # The string-aware balanced scan: the substring from the first `{` to its
    # matching `}`, or nil when the object never closes (the repair layer's
    # truncated-tail input). First-object-wins: the scan stops at the first
    # depth-zero `}` even if the candidate fails to parse.
    def balanced_candidate(text, start)
      depth = 0
      in_string = false
      escaped = false
      text[start..].each_char.with_index do |char, index|
        if in_string
          if escaped
            escaped = false
          elsif char == "\\"
            escaped = true
          elsif char == '"'
            in_string = false
          end
          next
        end
        case char
        when '"' then in_string = true
        when "{" then depth += 1
        when "}"
          depth -= 1
          return text[start..(start + index)] if depth.zero?
        end
      end
      nil
    end

    # The repair candidates for `text`, in trial order: tail completion first
    # (close an open string, then the open containers), then the same with
    # trailing commas stripped before the closers.
    def repair_candidates(text)
      closed = close_open_tail(text)
      [ closed, strip_trailing_commas(closed) ].uniq
    end

    # Truncated-tail completion: a string-aware scan closing what the reply
    # left open — the trailing string literal first, then every open `{`/`[`
    # innermost-first. A no-op on balanced input. A tail cut right AFTER a
    # backslash first escapes that backslash (appending `\` + `"`): a bare
    # appended quote would itself be escaped and the string would never
    # close.
    def close_open_tail(text)
      opens = []
      in_string = false
      escaped = false
      text.each_char do |char|
        if in_string
          if escaped
            escaped = false
          elsif char == "\\"
            escaped = true
          elsif char == '"'
            in_string = false
          end
          next
        end
        case char
        when '"' then in_string = true
        when "{" then opens << "}"
        when "[" then opens << "]"
        when "}", "]" then opens.pop
        end
      end
      return text unless in_string || opens.any?

      repaired = +(in_string ? text + (escaped ? "\\\"" : "\"") : text)
      repaired << opens.reverse.join
    end

    # Trailing-comma removal: `,` directly before a `}`/`]` (whitespace
    # between allowed) outside any string literal — the classic
    # model-reply-JSON slip. Commas inside strings are preserved.
    def strip_trailing_commas(text)
      out = +""
      in_string = false
      escaped = false
      index = 0
      while index < text.length
        char = text[index]
        if in_string
          if escaped
            escaped = false
          elsif char == "\\"
            escaped = true
          elsif char == '"'
            in_string = false
          end
          out << char
          index += 1
        elsif char == "," && text[index..].match?(/\A,\s*[}\]]/)
          index += 1 # drop the comma, keep the closer
        else
          in_string = true if char == '"'
          out << char
          index += 1
        end
      end
      out
    end

    private_class_method :balanced_candidate, :repair_candidates, :close_open_tail, :strip_trailing_commas
  end
end

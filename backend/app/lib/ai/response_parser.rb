# frozen_string_literal: true

module Ai
  # Model-reply parsing (epic P2-5 ticket 03): the one place that extracts a
  # JSON object from a provider reply. Models wrap JSON in prose or code
  # fences despite the prompt, so the extraction is a string-aware balanced
  # scan: from the first `{`, tracking depth and skipping string literals,
  # up to the matching `}`. Returns the JSON STRING or nil — the callers own
  # schema validation (an extracted object that fails the schema is the
  # INTERNAL path, not a silent accept).
  module ResponseParser
    module_function

    def extract_json_object(raw)
      text = raw.to_s
      start = text.index("{")
      return nil unless start

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
          if depth.zero?
            candidate = text[start..(start + index)]
            return candidate if valid_json?(candidate)
            return nil
          end
        end
      end
      nil
    end

    def valid_json?(string)
      JSON.parse(string)
      true
    rescue JSON::ParserError
      false
    end
  end
end

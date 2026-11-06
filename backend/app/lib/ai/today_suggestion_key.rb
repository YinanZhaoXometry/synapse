# frozen_string_literal: true

require "digest"

module Ai
  # The Today suggestion's deterministic replay key (epic-18 T2, spec
  # decision 9): uuid5 over a USER-SCOPED namespace + planId + UTC day.
  # The same (user, plan, UTC day) always derives the SAME uuid, so a
  # regeneration within the UTC day replays the persisted row for free
  # (replay-before-spend — ZERO provider calls, ZERO cap consumption) and
  # a new day derives a fresh uuid and spends again. The day half follows
  # the streak's midnight-UTC boundary convention (ADR-0001).
  #
  # THE EXACT DERIVATION — a cross-stack pin (ticket 04's frontend mirrors
  # it byte-for-byte; `spec/lib/ai/today_suggestion_key_spec.rb` pins the
  # literal test vectors, independently verified against RFC-4122
  # implementations):
  #
  #   namespace = the user's uuid, taken AS an RFC-4122 namespace
  #               (the 32 hex digits, dashes stripped, as the 16 namespace
  #               bytes)
  #   name      = "<planId>:<UTC day>" — the UTC day formatted "YYYY-MM-DD"
  #   uuid5     = RFC 4122 §4.3: SHA-1(namespace_bytes + name), first 16
  #               bytes, the version nibble forced to 5, the variant bits
  #               forced to 10 (RFC-4122), formatted lowercase 8-4-4-4-12.
  #
  # (A JS mirror: `uuid` npm v5 — `uuidv5(`${planId}:${day}`, userId)`.)
  module TodaySuggestionKey
    module_function

    def derive(user_id:, plan_id:, now: Time.current)
      uuid5(namespace: user_id, name: "#{plan_id}:#{now.utc.to_date.iso8601}")
    end

    # The RFC-4122 §4.3 name-based uuid (SHA-1, version 5). Pure string
    # math — no provider, no DB; the namespace must be uuid-shaped (the
    # command validates the plan id and the user id is a uuid PK before
    # this is ever reached).
    def uuid5(namespace:, name:)
      namespace_bytes = [ namespace.to_s.delete("-") ].pack("H32")
      digest = Digest::SHA1.digest(namespace_bytes + name.to_s)[0, 16]
      bytes = digest.unpack("C16")
      bytes[6] = (bytes[6] & 0x0F) | 0x50 # version 5
      bytes[8] = (bytes[8] & 0x3F) | 0x80 # RFC-4122 variant (10xx)
      octets = bytes.pack("C16").unpack1("H32")
      [ octets[0, 8], octets[8, 4], octets[12, 4], octets[16, 4], octets[20, 12] ].join("-")
    end
  end
end

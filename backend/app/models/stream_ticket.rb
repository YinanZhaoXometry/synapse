# frozen_string_literal: true

# One SSE stream ticket (AD-16, epic P2-5 ticket 04): an opaque single-use
# secret bound to its user + op, carrying the grounding inputs in `payload`
# (string-keyed jsonb — kickoff delta 4: ReadingPosition text and friends
# cannot ride query params). Minted ONLY by Ai::CreateStreamTicketCommand;
# redeemed ONLY through `.redeem`, whose single UPDATE … RETURNING makes
# replay impossible (a consumed or expired ticket never matches — the
# endpoint answers 401, never retrying auth).
class StreamTicket < ApplicationRecord
  belongs_to :user

  # The redemption result: the ticket's binding without re-reading the row —
  # nil when the ticket was bad, expired, consumed, or the op mismatched.
  # `payload` is decoded here because redeem's raw UPDATE … RETURNING (via
  # select_one) bypasses ActiveRecord's type casting: the jsonb column
  # arrives as a JSON string, and the controller needs the hash (the frozen
  # contract reads string keys off it).
  RedeemResult = Struct.new(:id, :user_id, :op, :payload, keyword_init: true) do
    def self.from_row(row)
      return nil unless row

      payload = row["payload"] || {}
      payload = JSON.parse(payload) if payload.is_a?(String)
      new(
        id: row["id"],
        user_id: row["user_id"],
        op: row["op"],
        payload: payload
      )
    end
  end

  class << self
    # Atomic single-use consume: at most ONE caller ever gets the row back;
    # a concurrent second redeem updates 0 rows → nil → 401. `now:` is
    # injectable for the TTL specs.
    def redeem(token, op, now: Time.current)
      sql = <<~SQL
        UPDATE stream_tickets
        SET consumed_at = :now, updated_at = :now
        WHERE token = :token AND op = :op
          AND consumed_at IS NULL AND expires_at > :now
        RETURNING id, user_id, op, payload
      SQL
      sanitized = ActiveRecord::Base.sanitize_sql_array([ sql, { token: token.to_s, op: op.to_s, now: now } ])
      RedeemResult.from_row(connection.select_one(sanitized))
    end
  end
end

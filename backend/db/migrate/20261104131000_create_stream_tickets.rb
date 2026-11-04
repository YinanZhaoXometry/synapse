# frozen_string_literal: true

# The SSE stream tickets (AD-16, epic P2-5 ticket 04): opaque single-use
# secrets minted by createStreamTicket, redeemed by GET /api/stream. The
# grounding inputs (ReadingPosition text, question, topic — up to 100k
# chars) ride INSIDE the payload jsonb, never as query params (kickoff
# delta 4 — query params are log-exposed by AD-16's accepted posture, and
# oversized).
#
# Rows are enforcement state, not domain data: consumed tickets are dead
# (the unique token + the atomic redeem make replay impossible), expired
# rows simply never match. Volume is bounded at MINT time by the command's
# MAX_LIVE_TICKETS bound (the daily cap counts redeems, not mints) — but
# consumed/expired rows accumulate across days by design: they are tiny,
# and no background sweep exists ("no new background work without a named
# need", AD-19).
class CreateStreamTickets < ActiveRecord::Migration[8.1]
  def change
    create_table :stream_tickets, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.string :op, null: false
      t.string :token, null: false
      t.jsonb :payload, null: false, default: {}
      t.datetime :expires_at, null: false
      t.datetime :consumed_at

      t.timestamps

      t.index %i[token], unique: true
      t.check_constraint "op IN ('companion', 'proposal')", name: "stream_tickets_op_check"
    end

    add_foreign_key :stream_tickets, :users, validate: false
  end
end

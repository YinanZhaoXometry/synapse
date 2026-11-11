# frozen_string_literal: true

require "rails_helper"

# StreamTicket.redeem (ticket 04): the atomic single-use consume — the 401
# matrix the endpoint builds on.
RSpec.describe StreamTicket do
  describe ".redeem" do
    let(:user) { create(:user) }
    let(:ticket) { create(:stream_ticket, user: user, op: "companion") }

    it "returns the binding on the first redeem and nil on replay" do
      first = described_class.redeem(ticket.token, "companion")
      expect(first).to be_present
      expect(first.user_id).to eq(user.id)
      expect(first.op).to eq("companion")
      expect(first.payload["question"]).to eq("Explain this section")

      expect(described_class.redeem(ticket.token, "companion")).to be_nil # replay → nil
    end

    it "refuses an op mismatch, an unknown token, and an expired ticket" do
      expect(described_class.redeem(ticket.token, "proposal")).to be_nil
      expect(described_class.redeem("not-a-real-token", "companion")).to be_nil

      expired = create(:stream_ticket, user: user, expires_at: 1.second.ago)
      expect(described_class.redeem(expired.token, "companion")).to be_nil
    end

    # epic-36 T1 (spec decision 4): the lesson op joins the frozen vocabulary
    # — constant + DB check constraint land together.
    it "admits the lesson op and keeps the database floor closed" do
      lesson_ticket = create(:stream_ticket, user: user, op: "lesson", payload: { "lesson_id" => "m-1", "language" => "zh" })
      expect(lesson_ticket.reload.op).to eq("lesson")
      expect(described_class.redeem(lesson_ticket.token, "lesson")).to be_present

      expect {
        lesson_ticket.update_columns(op: "lessonx")
      }.to raise_error(ActiveRecord::StatementInvalid)
    end

    it "is race-safe: concurrent redemptions admit exactly one caller",
       use_transactional_fixtures: false do
      ticket = create(:stream_ticket, user: user, op: "companion")

      threads = Array.new(4) { Thread.new { described_class.redeem(ticket.token, "companion") } }
      results = threads.map(&:value)

      expect(results.compact.length).to eq(1) # single-use, atomically
    ensure
      # FK order: tickets, then the factory payload's material, then the user.
      StreamTicket.where(user_id: user.id).delete_all
      Material.where(user_id: user.id).delete_all
      User.where(id: user.id).delete_all
    end
  end
end

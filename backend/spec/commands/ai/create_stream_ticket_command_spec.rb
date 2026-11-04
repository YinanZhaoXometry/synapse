# frozen_string_literal: true

require "rails_helper"

# Ai::CreateStreamTicketCommand (ticket 04): the mint path — payload shapes
# ARE the frozen contract (string-keyed, TS keys), bound to the user + op,
# TTL-config driven.
RSpec.describe Ai::CreateStreamTicketCommand do
  let(:user) { create(:user) }
  let(:material) { create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ]) }

  def call(**overrides)
    described_class.call(**{
      current_user: user,
      op: "companion",
      language: "zh",
      material_id: material.id,
      question: "What is scoping?",
      position: { locator: { kind: "markdown", section_id: "sec-1" }, text: "current view" },
      escalated: false
    }.merge(overrides))
  end

  it "mints a single-use ticket with the frozen companion payload shape" do
    result = call
    expect(result).to be_success
    ticket = result.value![:ticket]
    expect(ticket.user_id).to eq(user.id)
    expect(ticket.op).to eq("companion")
    expect(ticket.token).to be_present
    expect(ticket.token.length).to be >= 32
    expect(ticket.consumed_at).to be_nil
    expect(ticket.expires_at).to be_within(2.seconds).of(Ai.stream_ticket_ttl_seconds.seconds.from_now)
    expect(ticket.payload).to eq({
      "material_id" => material.id,
      "question" => "What is scoping?",
      "locator" => { "kind" => "markdown", "sectionId" => "sec-1" },
      "text" => "current view",
      "escalated" => false,
      "language" => "zh"
    })
  end

  it "normalizes pdf locators to the TS jsonb shape" do
    result = call(position: { locator: { kind: "pdf", page: 3 }, text: "page view" })
    expect(result.value![:ticket].payload["locator"]).to eq({ "kind" => "pdf", "page" => 3 })
  end

  it "mints proposal tickets with the ephemeral transcript inputs (AD-5)" do
    result = call(op: "proposal", material_id: nil, question: nil, position: nil,
                  topic: "软件工程", goal: "考好 COMP5241")
    expect(result).to be_success
    expect(result.value![:ticket].payload).to eq({
      "topic" => "软件工程", "goal" => "考好 COMP5241", "language" => "zh"
    })
  end

  it "refuses unknown ops, bad languages, foreign materials, empty questions, and bad locators" do
    other = create(:user)
    foreign = create(:material, user: other)

    expect(call(op: "chat").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
    expect(call(question: "  ").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(position: nil).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(position: { locator: { kind: "epub", section_id: "x" }, text: "t" }).failure.code).to eq(:VALIDATION_FAILED)
    # Scoped to THIS example's user — hermetic against leftover rows in a
    # persistent dev test database.
    expect(user.stream_tickets.count).to eq(0) # nothing minted on any refusal
  end

  it "enforces the payload bounds" do
    expect(call(question: "x" * 20_001).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "x" * 501).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "t", goal: "x" * 2_001).failure.code).to eq(:VALIDATION_FAILED)
  end

  describe ".ttl config" do
    around do |example|
      original = ENV["AI_STREAM_TICKET_TTL_SECONDS"]
      example.run
    ensure
      original.nil? ? ENV.delete("AI_STREAM_TICKET_TTL_SECONDS") : ENV["AI_STREAM_TICKET_TTL_SECONDS"] = original
    end

    it "defaults to ~60s and falls back on garbage" do
      ENV.delete("AI_STREAM_TICKET_TTL_SECONDS")
      expect(Ai.stream_ticket_ttl_seconds).to eq(60)
      ENV["AI_STREAM_TICKET_TTL_SECONDS"] = "garbage"
      expect(Ai.stream_ticket_ttl_seconds).to eq(60)
      ENV["AI_STREAM_TICKET_TTL_SECONDS"] = "30"
      expect(Ai.stream_ticket_ttl_seconds).to eq(30)
    end
  end
end

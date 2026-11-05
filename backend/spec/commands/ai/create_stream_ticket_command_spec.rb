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

  # epic-13 T1 (FR-13): the optional selection grounding input — the reader's
  # selection bar asks WITH the selected text. It rides the payload only when
  # present (the frozen shape above stays the no-selection shape), bounded
  # with the question's discipline.
  it "carries the bounded selection grounding input when present" do
    result = call(selection: "  Every row is scoped by user_id.  ")
    expect(result).to be_success
    expect(result.value![:ticket].payload["selection"]).to eq("Every row is scoped by user_id.")
  end

  it "omits the selection key when the input is blank (no grounding input, no key)" do
    result = call(selection: "   ")
    expect(result).to be_success
    expect(result.value![:ticket].payload).not_to have_key("selection")
  end

  it "refuses a selection past the question bound" do
    expect(call(selection: "x" * 20_001).failure.code).to eq(:VALIDATION_FAILED)
    expect(user.stream_tickets.count).to eq(0)
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

  it "bounds live tickets per user (the mint is not cap-counted — anti-hoarding)" do
    create_list(:stream_ticket, described_class::MAX_LIVE_TICKETS, user: user, op: "companion")

    result = call
    expect(result.failure.code).to eq(:RATE_LIMITED)
    expect(user.stream_tickets.where(consumed_at: nil).count).to eq(described_class::MAX_LIVE_TICKETS)
  end

  it "enforces the payload bounds" do
    expect(call(question: "x" * 20_001).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "x" * 501).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(op: "proposal", material_id: nil, question: nil, position: nil, topic: "t", goal: "x" * 2_001).failure.code).to eq(:VALIDATION_FAILED)
  end

  # epic P2-12 T3 (FR-46, delta decision 6): the THIRD stream op — plan-scope
  # chat with an optional mistake-entry grounding input. Payload shape frozen:
  # {plan_id, question, language, mistake_entry_id?} — string-keyed, TS keys.
  describe "plan_companion" do
    let(:plan) { create(:study_plan, user: user) }

    def plan_call(**overrides)
      described_class.call(**{
        current_user: user,
        op: "plan_companion",
        language: "zh",
        plan_id: plan.id,
        question: "这个计划我该先学什么？"
      }.merge(overrides))
    end

    it "mints with the frozen plan_companion payload shape (no mistake key when absent)" do
      result = plan_call
      expect(result).to be_success
      ticket = result.value![:ticket]
      expect(ticket.user_id).to eq(user.id)
      expect(ticket.op).to eq("plan_companion")
      expect(ticket.payload).to eq({
        "plan_id" => plan.id,
        "question" => "这个计划我该先学什么？",
        "language" => "zh"
      })
    end

    it "carries mistake_entry_id resolved through the user's OWN entries" do
      node = create(:knowledge_node, user: user, plan: plan)
      question = create(:question, user: user, node: node)
      entry = create(:mistake_entry, user: user, question: question, node: node)

      result = plan_call(mistake_entry_id: entry.id)
      expect(result.value![:ticket].payload).to eq({
        "plan_id" => plan.id,
        "question" => "这个计划我该先学什么？",
        "language" => "zh",
        "mistake_entry_id" => entry.id
      })
    end

    it "refuses a missing plan, foreign/unknown/malformed plans, and foreign/unknown/malformed mistake entries with uniform NOT_FOUND" do
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)
      foreign_entry = create(:mistake_entry, user: other)

      expect(plan_call(plan_id: nil).failure.code).to eq(:VALIDATION_FAILED)
      expect(plan_call(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
      expect(plan_call(plan_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(plan_call(mistake_entry_id: foreign_entry.id).failure.code).to eq(:NOT_FOUND)
      expect(plan_call(mistake_entry_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(user.stream_tickets.count).to eq(0) # nothing minted on any refusal
    end

    it "bounds the question like companion's and stays under the op-agnostic live-ticket bound" do
      expect(plan_call(question: "  ").failure.code).to eq(:VALIDATION_FAILED)
      expect(plan_call(question: "x" * 20_001).failure.code).to eq(:VALIDATION_FAILED)

      create_list(:stream_ticket, described_class::MAX_LIVE_TICKETS, user: user, op: "companion")
      expect(plan_call.failure.code).to eq(:RATE_LIMITED)
      expect(user.stream_tickets.where(consumed_at: nil).count).to eq(described_class::MAX_LIVE_TICKETS)
    end
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

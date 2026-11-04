# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateFlashcardsCommand (ticket 03) against a stubbed adapter — the
# deck persists through Flashcards::CreateFlashcardsCommand with server-minted
# card uuids, one cap call per generation.
RSpec.describe Ai::GenerateFlashcardsCommand do
  around do |example|
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:material) do
    create(:material, user: user, sections: [
      { "id" => "sec-1", "title" => "One", "text" => "first section body" },
      { "id" => "sec-2", "title" => "Two", "text" => "second section body" }
    ])
  end
  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def call(material_id: material.id, node_id: nil, language: "zh")
    described_class.call(current_user: user, material_id: material_id, node_id: node_id, language: language)
  end

  it "creates one card per usable section with server-minted uuids, consuming one cap call" do
    allow(adapter).to receive(:complete).and_return(
      { cards: [ { front: "Q1", back: "A1" }, { front: "Q2", back: "A2" } ] }.to_json
    )

    result = call
    expect(result).to be_success
    cards = result.value![:cards]
    expect(cards.length).to eq(2)
    expect(cards.map(&:front)).to eq(%w[Q1 Q2])
    expect(cards.map(&:material_id).uniq).to eq([ material.id ])
    expect(cards.map(&:node_id)).to eq([ nil, nil ])
    expect(cards.map(&:id).uniq.size).to eq(2) # server-minted uuids
    expect(cards.pluck(:id).all? { |id| id.match?(Accounts::UUID_REGEX) }).to be(true)
    expect(user.ai_usage_counters.sole.call_count).to eq(1)
  end

  it "attaches the node when one is given (AD-6, optional for decks)" do
    node = create(:knowledge_node, user: user)
    allow(adapter).to receive(:complete).and_return({ cards: [ { front: "Q", back: "A" } ] }.to_json)

    result = call(node_id: node.id)
    expect(result.value![:cards].sole.node_id).to eq(node.id)
  end

  it "drops unusable cards and fails INTERNAL when none survive" do
    allow(adapter).to receive(:complete).and_return(
      { cards: [ { front: "good", back: "pair" }, { front: "  ", back: "empty front" }, { front: "no back", back: "" } ] }.to_json
    )
    result = call
    expect(result).to be_success
    expect(result.value![:cards].sole.front).to eq("good")

    allow(adapter).to receive(:complete).and_return({ cards: [ { front: "", back: "" } ] }.to_json)
    expect(call.failure.code).to eq(:INTERNAL)
  end

  it "fails INTERNAL on a reply without JSON" do
    allow(adapter).to receive(:complete).and_return("sorry, no cards")
    expect(call.failure.code).to eq(:INTERNAL)
  end

  it "refuses unknown/foreign materials and bad languages before spending a call" do
    allow(adapter).to receive(:complete)
    other = create(:user)
    foreign = create(:material, user: other)

    expect(call(material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
    expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
  end
end

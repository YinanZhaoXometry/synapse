# frozen_string_literal: true

require "rails_helper"

RSpec.describe Flashcards::CreateFlashcardsCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:material) { create(:material, user: user, plan: plan) }
  let(:card_uuid) { SecureRandom.uuid }
  let(:second_uuid) { SecureRandom.uuid }
  let(:cards_attrs) do
    [
      { client_uuid: card_uuid, front: "What scopes every row?", back: "A user_id foreign key (AD-13)." },
      { client_uuid: second_uuid, front: "What moves a Mastery Score?", back: "EvidenceRecords only (ADR-0001)." }
    ]
  end

  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: material.id,
      node_id: nil,
      cards: cards_attrs,
      **overrides
    )
  end

  describe ".call" do
    it "creates the deck on the material in one transaction, difficulty unrated" do
      result = call

      expect(result.success?).to be(true)
      cards = result.value![:cards]
      expect(cards.map(&:id)).to eq([ card_uuid, second_uuid ])
      expect(cards.map(&:user_id)).to all(eq(user.id))
      expect(cards.map(&:material_id)).to all(eq(material.id))
      expect(cards.map(&:node_id)).to all(be_nil)
      expect(cards.map(&:difficulty)).to all(be_nil)
      expect(cards.first.front).to eq("What scopes every row?")
      expect(cards.first.back).to eq("A user_id foreign key (AD-13).")
      expect(user.flashcards.count).to eq(2)
    end

    it "attaches the optional node (a task's auto-node gives the deck an attribution target, AD-6)" do
      node = create(:knowledge_node, user: user, plan: plan)

      result = call(node_id: node.id)

      expect(result.value![:cards].map(&:node_id)).to all(eq(node.id))
    end

    it "is idempotent on replay with the same client uuids (delta 3): Success, same rows, no duplicates" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:cards].map(&:id)).to eq(first.value![:cards].map(&:id))
      expect(user.flashcards.count).to eq(2)
      expect(user.flashcards.where(id: card_uuid).count).to eq(1)
    end

    it "replays per card: a mixed batch of existing and new uuids creates only the missing rows" do
      call
      third_uuid = SecureRandom.uuid

      result = call(cards: cards_attrs + [ { client_uuid: third_uuid, front: "new", back: "card" } ])

      expect(result.value![:cards].map(&:id)).to eq([ card_uuid, second_uuid, third_uuid ])
      expect(user.flashcards.count).to eq(3)
    end

    it "fails VALIDATION_FAILED when a client uuid belongs to another user (never silently link, FR-4)" do
      foreign_card = create(:flashcard, user: create(:user))

      result = call(cards: [ { client_uuid: foreign_card.id, front: "f", back: "b" } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.flashcards.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(cards: [ { client_uuid: "not-a-uuid", front: "f", back: "b" } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.flashcards.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for duplicate client uuids within one batch" do
      result = call(cards: cards_attrs + [ { client_uuid: card_uuid, front: "dup", back: "dup" } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.flashcards.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank front or back" do
      aggregate_failures do
        blank_front = call(cards: [ { client_uuid: card_uuid, front: "  ", back: "b" } ])
        expect(blank_front.failure?).to be(true)
        expect(blank_front.failure.code).to eq(:VALIDATION_FAILED)

        blank_back = call(cards: [ { client_uuid: card_uuid, front: "f", back: "" } ])
        expect(blank_back.failure?).to be(true)
        expect(blank_back.failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.flashcards.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for an empty card list (a deck needs at least one card)" do
      result = call(cards: [])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.flashcards.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material id (delta 2)" do
      aggregate_failures do
        foreign = call(material_id: create(:material, user: create(:user)).id)
        expect(foreign.failure?).to be(true)
        expect(foreign.failure.code).to eq(:NOT_FOUND)

        unknown = call(material_id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(material_id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.flashcards.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed node id (delta 2)" do
      aggregate_failures do
        foreign = call(node_id: create(:knowledge_node, user: create(:user)).id)
        expect(foreign.failure?).to be(true)
        expect(foreign.failure.code).to eq(:NOT_FOUND)

        unknown = call(node_id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(node_id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.flashcards.count).to eq(0)
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

RSpec.describe Flashcards::RateFlashcardCommand do
  # The study-state write (kickoff delta 5): the difficulty self-rating
  # persists on the Flashcard row and NEVER creates EvidenceRecords (Phase 1
  # never treats flashcard flips as evidence — entities.ts; ADR-0001: the
  # Mastery Score moves on quiz evidence only).

  let(:user) { create(:user) }
  let(:card) { create(:flashcard, user: user) }

  def call(overrides = {})
    described_class.call(current_user: user, id: card.id, difficulty: "easy", **overrides)
  end

  describe ".call" do
    it "persists the difficulty self-rating on the card and returns it" do
      result = call

      expect(result.success?).to be(true)
      expect(result.value![:flashcard].difficulty).to eq("easy")
      expect(card.reload.difficulty).to eq("easy")
    end

    it "creates NO EvidenceRecords — the evidence table is untouched by design (delta 5)" do
      # Pre-existing evidence from real quiz answers must be the ONLY rows.
      create(:evidence_record, user: user, node: create(:knowledge_node, user: user))
      expect(user.evidence_records.count).to eq(1)

      call
      call(difficulty: "hard")
      call(difficulty: "medium")

      expect(user.evidence_records.count).to eq(1)
      expect(EvidenceRecord.where(question_id: card.id).count).to eq(0)
    end

    it "overwrites a previous rating (the latest self-rating stands)" do
      call(difficulty: "hard")
      result = call(difficulty: "medium")

      expect(result.value![:flashcard].difficulty).to eq("medium")
      expect(card.reload.difficulty).to eq("medium")
    end

    it "fails VALIDATION_FAILED for a difficulty outside hard|medium|easy" do
      result = call(difficulty: "impossible")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(card.reload.difficulty).to be_nil
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed card id (delta 2)" do
      aggregate_failures do
        foreign = call(id: create(:flashcard, user: create(:user)).id)
        expect(foreign.failure?).to be(true)
        expect(foreign.failure.code).to eq(:NOT_FOUND)

        unknown = call(id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(card.reload.difficulty).to be_nil
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

RSpec.describe Markings::ClaimSectionCommand do
  # The FR-15 Mastery Marking claim — a claim, never evidence: it can never
  # move a score (entities.ts; the SectionMarking model comment). No Phase-1
  # repository op exists (the type was declared for persistence to carry),
  # so the write semantics follow the ER's own law: the claim is a row with
  # a server-set claimed_at, an open claim is idempotent (no duplicate), and
  # history is preserved — claim → clear → re-claim lands a NEW row. The
  # evidence_records table must be untouched, asserted here and on the wire.

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: overrides.fetch(:material_id, material.id),
      section_id: overrides.fetch(:section_id, "sec-1")
    )
  end

  describe ".call" do
    it "creates the claim with a server-set claimed_at and a null cleared_at" do
      result = call(section_id: "sec-2")

      expect(result.success?).to be(true)
      marking = result.value![:section_marking]
      expect(marking.section_id).to eq("sec-2")
      expect(marking.claimed_at).to be_within(1.minute).of(Time.current)
      expect(marking.cleared_at).to be_nil
      expect(marking.user_id).to eq(user.id)
    end

    it "is idempotent while the claim is open — re-claiming returns the existing row, no duplicate" do
      first = call
      first_claimed_at = user.section_markings.find_by!(section_id: "sec-1").claimed_at

      second = call

      aggregate_failures do
        expect(user.section_markings.count).to eq(1)
        expect(second.value![:section_marking].id).to eq(first.value![:section_marking].id)
        expect(second.value![:section_marking].claimed_at).to eq(first_claimed_at)
      end
    end

    it "creates a NEW row after claim → unclaim → re-claim (history is preserved, nothing is unique)" do
      first = call
      Markings::UnclaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")
      third = call

      claims = user.section_markings.order(:created_at)
      aggregate_failures do
        expect(claims.count).to eq(2)
        expect(claims.first.id).to eq(first.value![:section_marking].id)
        expect(claims.first.cleared_at).to be_present
        expect(claims.last.id).to eq(third.value![:section_marking].id)
        expect(claims.last.cleared_at).to be_nil
      end
    end

    it "tracks sections independently within one material" do
      call(section_id: "sec-1")
      call(section_id: "sec-2")

      expect(user.section_markings.where(material_id: material.id).count).to eq(2)
    end

    it "creates NO EvidenceRecords — a claim is a claim, never evidence (FR-15 / delta 5's law)" do
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node)
      expect(user.evidence_records.count).to eq(1)

      call
      call(section_id: "sec-2")
      call # re-claim on the open claim
      Markings::UnclaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")

      aggregate_failures do
        expect(user.evidence_records.count).to eq(1)
        expect(EvidenceRecord.where(node_id: node.id).count).to eq(1)
        expect(EvidenceRecord.where(session_id: nil, question_id: nil).count).to eq(1)
      end
    end

    it "fails VALIDATION_FAILED for a blank section id (markings address sections by id — FR-18's rule)" do
      result = call(section_id: "   ")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.section_markings.count).to eq(0)
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
      expect(user.section_markings.count).to eq(0)
    end
  end
end

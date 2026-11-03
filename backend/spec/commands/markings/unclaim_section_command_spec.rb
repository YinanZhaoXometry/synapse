# frozen_string_literal: true

require "rails_helper"

RSpec.describe Markings::UnclaimSectionCommand do
  # The unmark — clearing an open claim sets cleared_at and preserves the
  # row (the ER's history law: nothing is deleted, nothing is unique). The
  # op addresses THE OPEN CLAIM for (user, material, section): no open claim
  # (never claimed, or already cleared) is a NOT_FOUND — the uniform
  # unknown-address answer (delta 2). It touches no other row and, a claim
  # being a claim, never the evidence_records table.

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
    it "sets cleared_at on the open claim and returns the updated row (claimed_at preserved)" do
      claim = Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id,
                                                section_id: "sec-1").value![:section_marking]

      result = call

      row = user.section_markings.find(claim.id)
      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:section_marking].id).to eq(claim.id)
        expect(row.cleared_at).to be_within(1.minute).of(Time.current)
        expect(row.claimed_at).to eq(claim.claimed_at)
      end
    end

    it "leaves other sections' claims untouched" do
      Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")
      other = Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id,
                                                 section_id: "sec-2").value![:section_marking]

      call(section_id: "sec-1")

      aggregate_failures do
        expect(other.reload.cleared_at).to be_nil
        expect(user.section_markings.count).to eq(2)
      end
    end

    it "answers NOT_FOUND when the section was never claimed" do
      result = call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "answers NOT_FOUND when the claim is already cleared (no open claim to address)" do
      Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")
      call

      result = call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.section_markings.count).to eq(1)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material id (delta 2)" do
      Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")

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
      expect(user.section_markings.where(cleared_at: nil).count).to eq(1)
    end

    it "creates NO EvidenceRecords — the claim's clearing moves nothing (FR-15)" do
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node)
      Markings::ClaimSectionCommand.call(current_user: user, material_id: material.id, section_id: "sec-1")

      call

      expect(user.evidence_records.count).to eq(1)
    end
  end
end

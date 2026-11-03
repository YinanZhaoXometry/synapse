# frozen_string_literal: true

require "rails_helper"

RSpec.describe Materials::SetMaterialParseResultCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) } # parse_state "pending" (column default)
  let(:sections) { [ { id: "sec-1", title: "Introduction", text: "The parsed extracted text." } ] }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      id: material.id,
      sections: sections,
      state: "parsed",
      reason: nil,
      **overrides
    )
  end

  describe ".call" do
    it "writes the parsed outcome: sections replaced, state parsed, failure cleared" do
      result = call

      expect(result.success?).to be(true)
      material = result.value![:material]
      expect(material.parse_state).to eq("parsed")
      expect(material.parse_failure_reason).to be_nil
      expect(material.sections).to eq(
        [ { "id" => "sec-1", "title" => "Introduction", "text" => "The parsed extracted text." } ]
      )
    end

    it "keeps the material's metadata (a failure write stores the outcome, not a rewrite)" do
      result = call(state: "failed", sections: [], reason: nil)

      material = result.value![:material]
      expect(material.title).to eq("Distributed systems lecture notes")
      expect(material.kind).to eq("markdown")
      expect(material.size_bytes).to eq(12_345)
      expect(material.parse_state).to eq("failed")
      expect(material.sections).to eq([])
    end

    it "defaults the failure reason to 'unknown' when a failed write carries none (Phase-1 mirror)" do
      result = call(state: "failed", sections: [], reason: nil)

      expect(result.value![:material].parse_failure_reason).to eq("unknown")
    end

    it "stores a given failure reason on a failed write" do
      result = call(state: "failed", sections: [], reason: "encrypted")

      expect(result.value![:material].parse_failure_reason).to eq("encrypted")
    end

    it "clears a previous failure on a successful write (Phase-1: a success clears any failure)" do
      material.update!(parse_state: "failed", parse_failure_reason: "corrupt")

      result = call

      material = result.value![:material]
      expect(material.parse_state).to eq("parsed")
      expect(material.parse_failure_reason).to be_nil
    end

    it "fails VALIDATION_FAILED for a state outside the write-back vocabulary (pending/parsing are attach states)" do
      aggregate_failures do
        expect(call(state: "pending").failure.code).to eq(:VALIDATION_FAILED)
        expect(call(state: "parsing").failure.code).to eq(:VALIDATION_FAILED)
        expect(call(state: "queued").failure.code).to eq(:VALIDATION_FAILED)
      end
    end

    it "fails VALIDATION_FAILED for a reason outside the closed vocabulary" do
      result = call(state: "failed", reason: "timeout")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(material.reload.parse_state).to eq("pending")
    end

    it "fails VALIDATION_FAILED when a section id is blank" do
      result = call(sections: [ { id: "", title: "x", text: "y" } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(material.reload.sections).to eq(material.sections) # untouched
    end

    it "fails VALIDATION_FAILED when a section exceeds the 100,000-character cap (kickoff delta 6)" do
      result = call(sections: [ { id: "sec-1", title: "Huge", text: "a" * (Materials::MAX_SECTION_CHARS + 1) } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(material.reload.parse_state).to eq("pending") # nothing written
    end

    it "answers NOT_FOUND for an unknown material id" do
      result = call(id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "answers NOT_FOUND for another user's material id (uniform NOT_FOUND, delta 2)" do
      foreign = create(:material, user: create(:user))

      result = call(id: foreign.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(foreign.reload.parse_state).to eq("pending")
    end

    it "answers NOT_FOUND for an id that is not uuid-shaped" do
      result = call(id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end
end

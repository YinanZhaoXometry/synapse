# frozen_string_literal: true

require "rails_helper"

RSpec.describe Progress::SaveReadingProgressCommand do
  # The reader's continue-line write — the Phase-1 progress-repository
  # saveReadingProgress mirror (frontend/src/data/progress-repository.ts):
  # an upsert keyed by the material (1:1, unique index — the re-save IS the
  # idempotency), carrying the domain ReadingPosition verbatim (AD-2 /
  # kickoff delta 7): locator {kind:"pdf",page} | {kind:"markdown",sectionId}
  # + text, jsonb with TS keys exactly, round-trip asserted.

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: overrides.fetch(:material_id, material.id),
      position: {
        locator: { kind: "markdown", section_id: "sec-1" },
        text: "…where the reader stopped."
      }.merge(overrides.except(:material_id))
    )
  end

  describe ".call" do
    it "creates the row and round-trips the position jsonb with TS keys verbatim" do
      result = call(locator: { kind: "pdf", page: 7 }, text: "page seven body")

      expect(result.success?).to be(true)
      row = user.reading_progresses.find_by!(material_id: material.id)
      expect(row.position).to eq(
        { "locator" => { "kind" => "pdf", "page" => 7 }, "text" => "page seven body" }
      )
      expect(result.value![:reading_progress].id).to eq(row.id)
      expect(row.updated_at).to be_within(1.minute).of(Time.current)
    end

    it "round-trips a markdown locator by sectionId" do
      call(locator: { kind: "markdown", section_id: "安装" })

      row = user.reading_progresses.find_by!(material_id: material.id)
      expect(row.position["locator"]).to eq({ "kind" => "markdown", "sectionId" => "安装" })
    end

    it "upserts over the same material — one row per material, the fresh position and updatedAt stand" do
      first = call(locator: { kind: "markdown", section_id: "sec-1" })
      first_updated_at = user.reading_progresses.find_by!(material_id: material.id).updated_at

      second = call(locator: { kind: "pdf", page: 12 }, text: "further in")

      row = user.reading_progresses.find_by!(material_id: material.id)
      aggregate_failures do
        expect(user.reading_progresses.where(material_id: material.id).count).to eq(1)
        expect(row.position).to eq(
          { "locator" => { "kind" => "pdf", "page" => 12 }, "text" => "further in" }
        )
        expect(row.updated_at).to be > first_updated_at
        expect(second.value![:reading_progress].id).to eq(first.value![:reading_progress].id)
      end
    end

    it "normalizes kind-irrelevant locator keys away (the CreateSessionCommand choice-shape mirror)" do
      call(locator: { kind: "markdown", section_id: "sec-1", page: 9 })

      row = user.reading_progresses.find_by!(material_id: material.id)
      expect(row.position["locator"]).to eq({ "kind" => "markdown", "sectionId" => "sec-1" })
    end

    it "accepts exactly 100,000 characters of text and refuses beyond (kickoff delta 6, the T02 bound)" do
      at_cap = call(text: "a" * Materials::MAX_SECTION_CHARS)
      over_cap = call(text: "a" * (Materials::MAX_SECTION_CHARS + 1))

      aggregate_failures do
        expect(at_cap.success?).to be(true)
        expect(over_cap.failure?).to be(true)
        expect(over_cap.failure.code).to eq(:VALIDATION_FAILED)
      end
    end

    it "accepts blank text (the Phase-1 save carries whatever the tracker extracted — no blank check)" do
      result = call(text: "")

      expect(result.success?).to be(true)
      expect(user.reading_progresses.find_by!(material_id: material.id).position["text"]).to eq("")
    end

    it "fails VALIDATION_FAILED for a malformed locator" do
      aggregate_failures do
        bad_kind = call(locator: { kind: "epub", section_id: "sec-1" })
        expect(bad_kind.failure.code).to eq(:VALIDATION_FAILED)

        pdf_without_page = call(locator: { kind: "pdf" })
        expect(pdf_without_page.failure.code).to eq(:VALIDATION_FAILED)

        zero_page = call(locator: { kind: "pdf", page: 0 })
        expect(zero_page.failure.code).to eq(:VALIDATION_FAILED)

        markdown_blank_section = call(locator: { kind: "markdown", section_id: "  " })
        expect(markdown_blank_section.failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.reading_progresses.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material id (delta 2) and writes nothing" do
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
      expect(user.reading_progresses.count).to eq(0)
    end
  end
end

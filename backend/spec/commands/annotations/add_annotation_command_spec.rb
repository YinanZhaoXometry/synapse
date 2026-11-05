# frozen_string_literal: true

require "rails_helper"

RSpec.describe Annotations::AddAnnotationCommand do
  # The FR-16 write (epic-13 T3, delta decisions 2+3): one user annotation
  # on one material — the AD-2 locator + range jsonb (TS keys verbatim),
  # kind/color, and the body note (v2-empty). The command owns the shape
  # law: locator per ReadingLocators, range per the delta-3 matrix
  # (sectionId xor page agreeing with the locator kind, int offsets,
  # non-empty quote), the closed kind/color vocabularies, the material
  # through the owner's association path (uniform NOT_FOUND).

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: overrides.fetch(:material_id, material.id),
      locator: overrides.fetch(:locator, { kind: "pdf", page: 3 }),
      range: overrides.fetch(:range, { page: 3, start: 12, end: 40, quote: "Scoping, commands, and the spine ER." }),
      kind: overrides.fetch(:kind, "highlight"),
      color: overrides[:color],
      body: overrides[:body]
    )
  end

  describe ".call" do
    it "creates the row and round-trips locator + range jsonb with TS keys verbatim" do
      result = call(locator: { kind: "markdown", section_id: "sec-1" },
                    range: { section_id: "sec-1", start: 0, end: 34, quote: "Scoping, commands, and the spine ER." })

      expect(result.success?).to be(true)
      row = user.annotations.sole
      aggregate_failures do
        expect(row.locator).to eq("kind" => "markdown", "sectionId" => "sec-1")
        expect(row.range).to eq(
          "sectionId" => "sec-1", "start" => 0, "end" => 34, "quote" => "Scoping, commands, and the spine ER."
        )
        expect(result.value![:annotation].id).to eq(row.id)
        expect(row.user_id).to eq(user.id)
        expect(row.material_id).to eq(material.id)
      end
    end

    it "defaults kind to highlight, color to nil, body to the empty note" do
      result = call

      row = user.annotations.sole
      aggregate_failures do
        expect(result.success?).to be(true)
        expect(row.kind).to eq("highlight")
        expect(row.color).to be_nil
        expect(row.body).to eq("")
      end
    end

    it "stores a named color and an underline kind verbatim" do
      result = call(kind: "underline", color: "emerald")

      row = user.annotations.sole
      aggregate_failures do
        expect(row.kind).to eq("underline")
        expect(row.color).to eq("emerald")
      end
    end

    it "stores a note body verbatim when one rides" do
      result = call(body: "Ask the tutor about this.")

      expect(user.annotations.sole.body).to eq("Ask the tutor about this.")
    end

    # ── the shape law (delta 3: the command validates on write; the DB
    # stores the range jsonb as-is) ──
    describe "range shape validation" do
      it "refuses a range without offsets" do
        result = call(range: { page: 3, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end

      it "refuses non-integer offsets" do
        result = call(range: { page: 3, start: "12", end: 40, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses negative offsets" do
        result = call(range: { page: 3, start: -1, end: 40, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses end before start" do
        result = call(range: { page: 3, start: 40, end: 12, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses a blank quote (the drift-verification span must exist)" do
        result = call(range: { page: 3, start: 12, end: 40, quote: "   " })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end

      it "refuses a range carrying neither sectionId nor page (nothing to anchor to)" do
        result = call(range: { start: 12, end: 40, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end
    end

    describe "locator/range agreement (sectionId xor page per kind)" do
      it "refuses a markdown annotation whose range carries a page instead of the sectionId" do
        result = call(locator: { kind: "markdown", section_id: "sec-1" },
                      range: { page: 3, start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end

      it "refuses a pdf annotation whose range carries a sectionId instead of the page" do
        result = call(range: { section_id: "sec-1", start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses a range carrying both sectionId and page" do
        result = call(locator: { kind: "markdown", section_id: "sec-1" },
                      range: { section_id: "sec-1", page: 3, start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses a markdown range whose sectionId disagrees with the locator" do
        result = call(locator: { kind: "markdown", section_id: "sec-1" },
                      range: { section_id: "sec-2", start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses a pdf range whose page disagrees with the locator" do
        result = call(range: { page: 9, start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
      end

      it "refuses a locator outside the AD-2 vocabulary (pdf without page)" do
        result = call(locator: { kind: "pdf" }, range: { page: 3, start: 0, end: 5, quote: "text" })

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end
    end

    describe "kind and color vocabularies" do
      it "refuses a kind outside highlight | underline" do
        result = call(kind: "scribble")

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end

      it "refuses a color outside the named palette keys" do
        result = call(color: "scarlet")

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end

      it "accepts every named palette key" do
        %w[coral amber emerald blue].each do |key|
          expect(call(color: key).success?).to be(true)
        end
        expect(user.annotations.where.not(color: nil).count).to eq(4)
      end
    end

    describe "body cap" do
      it "refuses a note beyond the 2,000-character cap" do
        result = call(body: "n" * (Annotations::MAX_NOTE_CHARS + 1))

        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.annotations.count).to eq(0)
      end
    end

    # ── addressing (delta 2): uniform NOT_FOUND, no existence leak ──
    it "answers NOT_FOUND for a foreign, unknown, or malformed material id" do
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
      expect(user.annotations.count).to eq(0)
      expect(Annotation.count).to eq(0)
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

# The Annotation entity (FR-16, epic-13 T3, delta 3): the epic-01 structural
# half (user + material + ReadingLocator jsonb + body) grown into its render
# surface — kind (highlight | underline, DB default highlight), color
# (nullable named palette key), range (the AD-2 domain range jsonb:
# sectionId xor page + start/end char offsets + the quote for drift
# verification). body stays the free-text note (empty for pure highlights).
RSpec.describe Annotation, type: :model do
  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  let(:model_attributes) do
    {
      user: user,
      material: material,
      locator: { kind: "pdf", page: 5 },
      range: { page: 5, start: 12, end: 40, quote: "Remember this" },
      body: ""
    }
  end

  it_behaves_like "a user-owned uuid model"
  include_examples "user-scoped", described_class

  it "carries a ReadingLocator jsonb + the range jsonb round-trip (TS keys verbatim)" do
    annotation = described_class.create!(model_attributes)

    annotation.reload
    aggregate_failures do
      expect(annotation.locator).to eq("kind" => "pdf", "page" => 5)
      expect(annotation.range).to eq("page" => 5, "start" => 12, "end" => 40, "quote" => "Remember this")
    end
  end

  describe "kind" do
    it "defaults to highlight (the DB default — pure-highlight rows omit it)" do
      annotation = described_class.create!(model_attributes)

      expect(annotation.reload.kind).to eq("highlight")
    end

    %w[highlight underline].each do |kind|
      it "accepts kind #{kind}" do
        annotation = described_class.create!(model_attributes.merge(kind: kind))

        expect(annotation.reload.kind).to eq(kind)
      end
    end

    it "refuses a kind outside the closed vocabulary (the enum raises on assignment)" do
      expect { described_class.create!(model_attributes.merge(kind: "scribble")) }
        .to raise_error(ArgumentError, /not a valid/)
    end

    it "pins the closed vocabulary at the DB floor (a raw write bypassing the enum is refused)" do
      annotation = described_class.create!(model_attributes)

      expect {
        described_class.where(id: annotation.id).update_all(kind: "scribble")
      }.to raise_error(ActiveRecord::StatementInvalid, /annotations_kind_check/)
    end
  end

  describe "color" do
    it "is nullable — a pure highlight may ride the reader's default" do
      annotation = described_class.create!(model_attributes)

      expect(annotation.reload.color).to be_nil
    end

    it "stores a named palette key verbatim" do
      annotation = described_class.create!(model_attributes.merge(color: "amber"))

      expect(annotation.reload.color).to eq("amber")
    end
  end

  describe "range" do
    it "is nullable (the epic-01 rows predate ranges; imports may land bare)" do
      annotation = described_class.create!(model_attributes.except(:range))

      expect(annotation.reload.range).to be_nil
    end

    it "round-trips a markdown range by sectionId" do
      annotation = described_class.create!(
        model_attributes.merge(
          locator: { kind: "markdown", section_id: "sec-1" },
          range: { sectionId: "sec-1", start: 0, end: 13, quote: "Remember this" }
        )
      )

      expect(annotation.reload.range).to eq("sectionId" => "sec-1", "start" => 0, "end" => 13, "quote" => "Remember this")
    end
  end

  describe "body" do
    it "defaults empty — the pure highlight (the note stays a v2)" do
      annotation = described_class.create!(model_attributes.merge(body: ""))

      expect(annotation.reload.body).to eq("")
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

# Materials::SectionValidation (epic P3-17 ticket 07 — first direct spec):
# the shared section-payload rules for AttachMaterialCommand and
# SetMaterialParseResultCommand. The host command specs exercise the happy
# paths; this pins every refusal leg and the boundary of the delta-6 cap.
RSpec.describe Materials::SectionValidation do
  let(:host) do
    Class.new(ApplicationCommand) do
      include Materials::SectionValidation
    end.new
  end

  it "accepts a clean payload (nil — the module's clean contract)" do
    sections = [ { id: "sec-1", title: "S", text: "body" } ]
    expect(host.validate_sections!(sections)).to be_nil
  end

  it "refuses a blank section id (the provenance chain, FR-18/NFR-1)" do
    result = host.validate_sections!([ { id: " ", title: "S", text: "body" } ])
    aggregate_failures do
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:sections)
      expect(result.failure.context[:message]).to include("section id is required")
    end
  end

  it "refuses text beyond the delta-6 cap without truncating" do
    over = [ { id: "sec-1", title: "S", text: "x" * (Materials::MAX_SECTION_CHARS + 1) } ]
    result = host.validate_sections!(over)
    aggregate_failures do
      expect(result).to be_failure
      expect(result.failure.context[:message]).to include("character cap")
      expect(over[0][:text].length).to eq(Materials::MAX_SECTION_CHARS + 1) # no server-side truncation
    end
  end

  it "accepts text at exactly the cap (the boundary is inclusive)" do
    at_cap = [ { id: "sec-1", title: "S", text: "x" * Materials::MAX_SECTION_CHARS } ]
    expect(host.validate_sections!(at_cap)).to be_nil
  end

  it "reports the FIRST failing section" do
    sections = [
      { id: "good", title: "S", text: "body" },
      { id: " ", title: "S", text: "no id" }
    ]
    expect(host.validate_sections!(sections).failure.context[:message]).to include("section id is required")
  end

  it "shapes the jsonb rows with the string keys the factories pin (id/title/text)" do
    sections = [ { id: "sec-1", title: "T", text: "body" } ]
    jsonb = host.send(:sections_as_jsonb, sections)
    expect(jsonb).to eq([ { "id" => "sec-1", "title" => "T", "text" => "body" } ])
  end
end

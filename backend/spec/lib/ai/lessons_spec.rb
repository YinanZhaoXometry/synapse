# frozen_string_literal: true

require "rails_helper"

# Ai::Lessons (epic-36 T1, spec decision 10): the generated-lesson template
# constants — the ONLY place the call ceilings live — and the estimate
# function derived from them (never a hand-written cost table). The estimate
# is the shared source for the entry pages (a template-shaped range) and the
# outline confirm page (an exact count from the confirmed outline size).
RSpec.describe Ai::Lessons do
  describe ".estimate" do
    it "derives the node-variant band from the template constants (outline 1 + sections 4–6)" do
      estimate = described_class.estimate(variant: "node")

      aggregate_failures do
        expect(estimate.outline_calls).to eq(described_class::NODE_OUTLINE_CALLS)
        expect(estimate.sections_min).to eq(described_class::NODE_SECTION_MIN)
        expect(estimate.sections_max).to eq(described_class::NODE_SECTION_MAX)
        expect(estimate.total_min).to eq(estimate.outline_calls + estimate.sections_min)
        expect(estimate.total_max).to eq(estimate.outline_calls + estimate.sections_max)
      end
    end

    it "gives the material variant the propose-shaped range when no outline size is known yet" do
      estimate = described_class.estimate(variant: "material")

      aggregate_failures do
        expect(estimate.outline_calls).to eq(described_class::MATERIAL_OUTLINE_CALLS)
        expect(estimate.sections_min).to eq(1)
        expect(estimate.sections_max).to eq(described_class::MATERIAL_MAX_SECTIONS)
        expect(estimate.total_min).to eq(estimate.outline_calls + 1)
        expect(estimate.total_max).to eq(estimate.outline_calls + described_class::MATERIAL_MAX_SECTIONS)
      end
    end

    it "pins an exact count when the confirmed outline size rides (the confirm page's shape)" do
      estimate = described_class.estimate(variant: "material", section_count: 3)

      aggregate_failures do
        expect(estimate.sections_min).to eq(3)
        expect(estimate.sections_max).to eq(3)
        expect(estimate.total_min).to eq(4)
        expect(estimate.total_max).to eq(4)
      end
    end

    it "caps the exact count at the material template ceiling (a bigger outline never estimates past it)" do
      estimate = described_class.estimate(variant: "material", section_count: 12)

      expect(estimate.sections_max).to eq(described_class::MATERIAL_MAX_SECTIONS)
      expect(estimate.total_max).to eq(described_class::MATERIAL_OUTLINE_CALLS + described_class::MATERIAL_MAX_SECTIONS)
    end

    it "answers nil for an unknown variant — the resolver owns the refusal" do
      expect(described_class.estimate(variant: "book")).to be_nil
    end
  end

  describe ".outline_placeholder" do
    it "mints the pending outline entries server-side (ids by position, anchors verbatim, status pending)" do
      chapters = [
        { title: "Raft 选举", anchors: [ { materialId: "m-1", sectionId: "sec-1" } ] },
        { title: "日志复制", anchors: [ { materialId: "m-1", sectionId: "sec-2" }, { materialId: "m-2", sectionId: "page-3" } ] }
      ]

      outline = described_class.outline_placeholder(chapters)

      aggregate_failures do
        expect(outline.map { |chapter| chapter["id"] }).to eq(%w[ch-1 ch-2])
        expect(outline.map { |chapter| chapter["title"] }).to eq([ "Raft 选举", "日志复制" ])
        expect(outline.second["anchors"]).to eq([ { "materialId" => "m-1", "sectionId" => "sec-2" },
                                                  { "materialId" => "m-2", "sectionId" => "page-3" } ])
        expect(outline.map { |chapter| chapter["status"] }).to eq(%w[pending pending])
      end
    end
  end

  describe ".node_confirmed_pairs" do
    # Review F2 (spec decision 8's 后端半边): the engine's pairs carry
    # confirmed UPLOADED mappings only — a generated lesson mapped onto the
    # node never becomes a chapter's anchor material.
    it "keeps confirmed uploaded mappings only; a generated lesson mapped onto the node never enters the pairs" do
      user = create(:user)
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      uploaded = create(:material, user: user, plan: plan, parse_state: "parsed", sections: [
        { "id" => "sec-1", "title" => "Raft", "text" => "leader election" }
      ])
      lesson = create(:material, user: user, plan: plan, origin: "generated", parse_state: "parsed",
                                 sections: [ { "id" => "les-sec", "title" => "讲义节", "text" => "讲义正文" } ],
                                 generation: { "variant" => "material", "sourceMaterialIds" => [],
                                               "outline" => [], "pausedKind" => nil, "generatedAt" => Time.current.iso8601 })
      create(:material_node_mapping, :confirmed, user: user, material: uploaded, node: node, section_id: "sec-1")
      create(:material_node_mapping, :confirmed, user: user, material: lesson, node: node, section_id: "les-sec")

      pairs = described_class.node_confirmed_pairs(node)

      aggregate_failures do
        expect(pairs.keys).to eq(%w[sec-1])
        expect(pairs["sec-1"].id).to eq(uploaded.id)
      end
    end
  end
end

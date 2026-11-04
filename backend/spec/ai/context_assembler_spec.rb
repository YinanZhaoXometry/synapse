# frozen_string_literal: true

require "rails_helper"

# Ai::ContextAssembler (ticket 01): Postgres-sourced context, deterministic
# bounding, ReadingPosition grounding. The budget rules here are ticket 02's
# context-in contract — these specs pin them at the module where they live.
RSpec.describe Ai::ContextAssembler do
  describe ".estimate_tokens" do
    it "is the fixed 3-chars-per-token ceiling estimate" do
      expect(described_class.estimate_tokens("123456789")).to eq(3) # 9 chars, ceil(9/3)
      expect(described_class.estimate_tokens("12中文汉字字")).to eq(3) # 7 chars → ceil(7/3)
      expect(described_class.estimate_tokens("")).to eq(0)
      expect(described_class.estimate_tokens(nil)).to eq(0)
    end
  end

  describe ".plan_scope" do
    let(:user) { create(:user) }
    let(:plan) { create(:study_plan, user: user) }

    before do
      create(:knowledge_node, user: user, plan: plan, title: "Node B", order: 2)
      create(:knowledge_node, user: user, plan: plan, title: "Node A", order: 1)
    end

    def long_section(id, chars)
      { "id" => id, "title" => "Section #{id}", "text" => ("a" * chars) }
    end

    it "assembles nodes first (in order), then each material's sections whole" do
      material = create(:material, user: user, plan: plan, sections: [ long_section("s1", 60), long_section("s2", 60) ])

      assembled = described_class.plan_scope(plan)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[node id=#{plan.knowledge_nodes.order(:order, :id).first.id} stage= order=")
      expect(assembled.text).to include("Node A")
      expect(assembled.text).to include("[material id=#{material.id}")
      expect(assembled.text).to include("[section id=s1")
      expect(assembled.text).to include("[section id=s2")
    end

    it "orders materials by attach time, not title" do
      first = create(:material, user: user, plan: plan, title: "Zebra notes", sections: [ long_section("z", 30) ])
      second = create(:material, user: user, plan: plan, title: "Alpha notes", sections: [ long_section("a", 30) ])

      assembled = described_class.plan_scope(plan)
      expect(assembled.text.index("Zebra notes")).to be < assembled.text.index("Alpha notes")
      expect(assembled.truncated).to be(false)
      expect(first.created_at).to be <= second.created_at # order sanity
    end

    it "drops later materials (truncated) when the budget runs out mid-scope" do
      create(:material, user: user, plan: plan, sections: [ long_section("s1", 900) ])
      create(:material, user: user, plan: plan, sections: [ long_section("s2", 30) ])

      # Nodes + head + first section ≈ well past 200 tokens.
      assembled = described_class.plan_scope(plan, budget: 200)

      expect(assembled.truncated).to be(true)
      expect(assembled.text).to include("[section id=s1")
      expect(assembled.text).not_to include("[section id=s2")
    end

    it "hard-truncates the first section when nothing fits whole" do
      material = create(:material, user: user, plan: plan, sections: [ long_section("s1", 3_000) ])

      assembled = described_class.plan_scope(plan, budget: 100)

      expect(assembled.truncated).to be(true)
      expect(assembled.text).to include(Ai::ContextAssembler::TRUNCATION_MARKER)
      # Bound respected: the estimate of the assembled text stays under the
      # budget (plus the marker's own chars).
      expect(described_class.estimate_tokens(assembled.text)).to be <= 105
      expect(material.sections.first["text"].length).to be > 100 # it was real text that got cut
    end

    it "is deterministic: identical inputs assemble to identical text" do
      create(:material, user: user, plan: plan, sections: [ long_section("s1", 120) ])
      create(:material, user: user, plan: plan, sections: [ long_section("s2", 120) ])

      first = described_class.plan_scope(plan, budget: 150)
      second = described_class.plan_scope(plan, budget: 150)
      expect(first.text).to eq(second.text)
      expect(first.truncated).to eq(second.truncated)
    end
  end

  describe ".task_scope" do
    it "assembles the task's single node + its material" do
      user = create(:user)
      node = create(:knowledge_node, user: user, title: "Solo node")
      material = create(:material, user: user, sections: [ { "id" => "t1", "title" => "T", "text" => "task text" } ])
      # Triangle via the factory: node/material passed as overrides, task_id
      # back-filled by after(:create) (factories/study_tasks.rb).
      task = create(:study_task, user: user, node: node, material: material)

      assembled = described_class.task_scope(task)
      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("Solo node")
      expect(assembled.text).to include("[section id=t1")
    end
  end

  describe ".mapping_scope" do
    let(:user) { create(:user) }
    let(:plan) { create(:study_plan, user: user) }

    before do
      create(:knowledge_node, user: user, plan: plan, title: "Node A", order: 0)
    end

    def material_with_sections(count, chars)
      create(:material, user: user, plan: plan,
                        sections: Array.new(count) { |i| { "id" => "s#{i}", "title" => "Section #{i}", "text" => ("a" * chars) } })
    end

    it "lists the plan's nodes and the full section index, section bodies riding before the index" do
      material = material_with_sections(2, 60)

      assembled = described_class.mapping_scope(plan, material)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[nodes]")
      expect(assembled.text).to include("Node A")
      expect(assembled.text).to include("sections index") # the index header
      expect(assembled.text).to include("[section id=s0]") # index line for every section
      expect(assembled.text).to include("[section id=s1]")
      expect(assembled.text).to include("[section id=s0 title=\"Section 0\"]") # bounded body blocks
      # Body first, index last (the addressability backbone rides after).
      expect(assembled.text.index("[section id=s0 title=")).to be < assembled.text.index("sections index")
    end

    it "keeps the never-exceeds-budget invariant when the index fits" do
      material = material_with_sections(4, 900) # big bodies, small index

      assembled = described_class.mapping_scope(plan, material, budget: 200)

      expect(assembled.truncated).to be(true) # the bodies had to be cut
      expect(described_class.estimate_tokens(assembled.text)).to be <= 200
      # Every section stays addressable through the index even when its
      # body was cut or dropped (the coverage contract).
      expect(assembled.text).to include("[section id=s3]")
    end

    it "truncates the index (never overflows) when the index alone exceeds the budget" do
      material = material_with_sections(30, 200) # 30 index lines dwarf a tiny budget

      assembled = described_class.mapping_scope(plan, material, budget: 50)

      expect(assembled.truncated).to be(true)
      expect(assembled.text).to include(Ai::ContextAssembler::TRUNCATION_MARKER)
      expect(described_class.estimate_tokens(assembled.text)).to be <= 50
    end
  end

  describe ".companion_grounding" do
    let(:user) { create(:user) }
    let(:material) do
      create(:material, user: user, sections: [
        { "id" => "sec-1", "title" => "Intro", "text" => "intro text " * 10 },
        { "id" => "sec-2", "title" => "Deep", "text" => "deep text " * 10 }
      ])
    end

    it "puts the ReadingPosition text first, the focus section in full, and the section index last" do
      position = { "locator" => { "kind" => "markdown", "sectionId" => "sec-1" }, "text" => "user's current view" }

      assembled = described_class.companion_grounding(material, position)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[reading position]\nuser's current view")
      expect(assembled.text).to include("[section id=sec-1 title=\"Intro\"]")
      expect(assembled.text).to include("intro text")
      expect(assembled.text).to include("[section id=sec-2]") # index line
      expect(assembled.text.index("[reading position]")).to be < assembled.text.index("[section id=sec-1")
    end

    it "resolves pdf locators to page-N section ids" do
      material = create(:material, user: user, kind: "pdf", sections: [
        { "id" => "page-1", "title" => "Page 1", "text" => "first page" },
        { "id" => "page-2", "title" => "Page 2", "text" => "second page " * 10 }
      ])
      position = { "locator" => { "kind" => "pdf", "page" => 2 }, "text" => "on page 2" }

      assembled = described_class.companion_grounding(material, position)
      expect(assembled.text).to include("[section id=page-2 title=\"Page 2\"]")
      expect(assembled.text).to include("second page")
    end

    it "keeps assembling (position + index) when the focus section id matches nothing" do
      position = { "locator" => { "kind" => "markdown", "sectionId" => "missing" }, "text" => "view text" }

      assembled = described_class.companion_grounding(material, position)
      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[reading position]")
      expect(assembled.text).not_to include("[section id=missing")
    end

    it "bounds the position text with the truncation marker" do
      position = { "locator" => { "kind" => "markdown", "sectionId" => "sec-1" }, "text" => ("x" * 5_000) }

      assembled = described_class.companion_grounding(material, position, budget: 100)
      expect(assembled.truncated).to be(true)
      expect(assembled.text).to include(Ai::ContextAssembler::TRUNCATION_MARKER)
    end

    it "keeps the never-exceeds-budget invariant when the position block is hard-cut" do
      # The block's own header/newlines are budgeted too (epic review
      # finding): the assembled estimate stays within the budget.
      position = { "locator" => { "kind" => "markdown", "sectionId" => "sec-1" }, "text" => ("x" * 5_000) }

      assembled = described_class.companion_grounding(material, position, budget: 150)
      expect(described_class.estimate_tokens(assembled.text)).to be <= 152
    end
  end

  describe ".default_budget" do
    around do |example|
      original = ENV["AI_CONTEXT_BUDGET_TOKENS"]
      example.run
    ensure
      original.nil? ? ENV.delete("AI_CONTEXT_BUDGET_TOKENS") : ENV["AI_CONTEXT_BUDGET_TOKENS"] = original
    end

    it "falls back to the spine default when ENV is absent or garbage" do
      ENV.delete("AI_CONTEXT_BUDGET_TOKENS")
      expect(described_class.default_budget).to eq(8_000)
      ENV["AI_CONTEXT_BUDGET_TOKENS"] = "garbage"
      expect(described_class.default_budget).to eq(8_000)
      ENV["AI_CONTEXT_BUDGET_TOKENS"] = "4096"
      expect(described_class.default_budget).to eq(4096)
    end
  end

  describe ".section_by_id" do
    it "finds a section by id and misses gracefully" do
      user = create(:user)
      material = create(:material, user: user, sections: [ { "id" => "sec-9", "title" => "T", "text" => "t" } ])
      expect(described_class.section_by_id(material, "sec-9")["title"]).to eq("T")
      expect(described_class.section_by_id(material, "nope")).to be_nil
    end
  end
end

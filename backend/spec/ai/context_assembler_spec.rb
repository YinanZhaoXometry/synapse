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

    # THE AC HEART (FR-44, epic P2-10 T2; AD-16 assembly-level enforcement):
    # a node-pinned material's sections feed only its node — they are
    # PROVABLY ABSENT from the plan-wide generation surface, asserted on the
    # exact section text substring.
    it "provably excludes a node-pinned material's section text from the plan scope" do
      wide_marker = "PLAN-WIDE-ONLY-SENTENCE-ABOUT-CONSISTENCY"
      pinned_marker = "NODE-PINNED-SECRET-SENTENCE-ABOUT-BYZANTINE-AGREEMENT"
      create(:material, user: user, plan: plan, sections: [
        { "id" => "wide-1", "title" => "Wide", "text" => wide_marker }
      ])
      pinned_node = plan.knowledge_nodes.order(:order, :id).first
      create(:material, user: user, plan: plan, attachment_scope: "node", node: pinned_node, sections: [
        { "id" => "pinned-1", "title" => "Pinned", "text" => pinned_marker }
      ])

      assembled = described_class.plan_scope(plan)

      aggregate_failures do
        expect(assembled.text).to include(wide_marker) # plan-wide material still feeds
        expect(assembled.text).not_to include(pinned_marker) # the pinned text NEVER rides
        expect(assembled.text).not_to include("[section id=pinned-1")
        expect(assembled.truncated).to be(false) # nothing silently cut — it was scoped, not truncated
      end
    end

    it "keeps assembling every plan-wide material when node-pinned siblings exist" do
      first = create(:material, user: user, plan: plan, sections: [ long_section("wide-1", 60) ])
      second = create(:material, user: user, plan: plan, sections: [ long_section("wide-2", 60) ])
      pinned_node = plan.knowledge_nodes.order(:order, :id).first
      create(:material, user: user, plan: plan, attachment_scope: "node", node: pinned_node,
                        sections: [ long_section("pinned-1", 60) ])

      assembled = described_class.plan_scope(plan)

      aggregate_failures do
        expect(assembled.text).to include("[material id=#{first.id}")
        expect(assembled.text).to include("[material id=#{second.id}")
        expect(assembled.text).not_to include("[section id=pinned-1")
      end
    end
  end

  describe ".node_scope" do
    let(:user) { create(:user) }
    let(:plan) { create(:study_plan, user: user) }

    before do
      create(:knowledge_node, user: user, plan: plan, title: "Node A", order: 1)
      create(:knowledge_node, user: user, plan: plan, title: "Node B", order: 2)
    end

    def long_section(id, chars)
      { "id" => id, "title" => "Section #{id}", "text" => ("a" * chars) }
    end

    # The FR-44 primitive (epic P2-10 T2): one node's grounding + quiz
    # generation surface — the single node, plan-wide materials, and the
    # node's OWN pinned materials, in stable attach-time order. This is what
    # node-scoped generation consumes (T5's targeting); nothing wires it yet.
    it "assembles the single node, plan-wide materials, and its own pinned material" do
      node_a = plan.knowledge_nodes.order(:order, :id).first
      wide = create(:material, user: user, plan: plan, sections: [
        { "id" => "wide-1", "title" => "Wide", "text" => "PLAN-WIDE-SHARED-TEXT" }
      ])
      pinned = create(:material, user: user, plan: plan, attachment_scope: "node", node: node_a, sections: [
        { "id" => "pinned-a", "title" => "Pinned A", "text" => "NODE-A-PINNED-TEXT" }
      ])

      assembled = described_class.node_scope(plan, node_a)

      aggregate_failures do
        expect(assembled.truncated).to be(false)
        expect(assembled.text).to include("[node id=#{node_a.id}")
        expect(assembled.text).to include("Node A")
        expect(assembled.text).to include("[material id=#{wide.id}")
        expect(assembled.text).to include("PLAN-WIDE-SHARED-TEXT")
        expect(assembled.text).to include("[material id=#{pinned.id}")
        expect(assembled.text).to include("NODE-A-PINNED-TEXT")
      end
    end

    it "provably excludes ANOTHER node's pinned material (pinned content never leaks, FR-44)" do
      node_a = plan.knowledge_nodes.order(:order, :id).first
      node_b = plan.knowledge_nodes.order(:order, :id).second
      create(:material, user: user, plan: plan, attachment_scope: "node", node: node_b, sections: [
        { "id" => "pinned-b", "title" => "Pinned B", "text" => "NODE-B-PINNED-SECRET-TEXT" }
      ])

      assembled = described_class.node_scope(plan, node_a)

      aggregate_failures do
        expect(assembled.text).not_to include("NODE-B-PINNED-SECRET-TEXT")
        expect(assembled.text).not_to include("[section id=pinned-b")
        expect(assembled.truncated).to be(false) # scoped away, never truncated away
      end
    end

    it "renders ONLY the one node — the other plan nodes never ride" do
      node_a = plan.knowledge_nodes.order(:order, :id).first

      assembled = described_class.node_scope(plan, node_a)

      expect(assembled.text).not_to include("Node B")
    end

    it "orders materials by attach time across both scopes (plan-wide and pinned interleaved)" do
      node_a = plan.knowledge_nodes.order(:order, :id).first
      first = create(:material, user: user, plan: plan, title: "First attach", sections: [ long_section("f", 30) ])
      pinned = create(:material, user: user, plan: plan, title: "Second attach — pinned", attachment_scope: "node", node: node_a,
                                  sections: [ long_section("p", 30) ])
      third = create(:material, user: user, plan: plan, title: "Third attach", sections: [ long_section("t", 30) ])

      assembled = described_class.node_scope(plan, node_a)

      aggregate_failures do
        expect(assembled.text.index("First attach")).to be < assembled.text.index("Second attach — pinned")
        expect(assembled.text.index("Second attach — pinned")).to be < assembled.text.index("Third attach")
      end
      expect(first.created_at).to be <= pinned.created_at
      expect(pinned.created_at).to be <= third.created_at
    end

    it "stays inside the budget with the same bounding rules as the other scopes" do
      node_a = plan.knowledge_nodes.order(:order, :id).first
      create(:material, user: user, plan: plan, sections: [ long_section("s1", 900) ])
      create(:material, user: user, plan: plan, attachment_scope: "node", node: node_a,
                        sections: [ long_section("s2", 30) ])

      assembled = described_class.node_scope(plan, node_a, budget: 200)

      aggregate_failures do
        expect(assembled.truncated).to be(true)
        expect(assembled.text).to include("[section id=s1")
        expect(assembled.text).not_to include("[section id=s2")
        expect(described_class.estimate_tokens(assembled.text)).to be <= 200
      end
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

  # Plan grounding (FR-46, epic P2-12 T3): the plan-scope chat surface —
  # mistake-first when an entry rides (companion_grounding's position-text
  # pattern), then the bounded plan_scope text, then the confirmed-mapping
  # block. Budget discipline matches the other variants: deterministic,
  # estimate ≤ budget, truncated flag honest.
  describe ".plan_grounding" do
    let(:user) { create(:user) }
    let(:plan) { create(:study_plan, user: user) }

    def long_section(id, chars)
      { "id" => id, "title" => "Section #{id}", "text" => ("a" * chars) }
    end

    it "without a mistake: the bounded plan_scope text rides with the confirmed-mapping block" do
      node = create(:knowledge_node, user: user, plan: plan, title: "Scoping", order: 1)
      material = create(:material, user: user, plan: plan, title: "Lecture notes", sections: [
        { "id" => "sec-1", "title" => "Intro", "text" => "Every row is scoped by user_id." }
      ])
      create(:material_node_mapping, :confirmed, user: user, material: material, node: node, section_id: "sec-1")
      # Proposed (not confirmed) and node-less rows never ride the block.
      create(:material_node_mapping, user: user, material: material, node: node, section_id: "sec-2", proposed_node_title: "Gap")
      create(:material_node_mapping, :confirmed, user: user, material: material, section_id: "sec-x")

      assembled = described_class.plan_grounding(plan)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[nodes]")
      expect(assembled.text).to include("[material id=#{material.id}")
      expect(assembled.text).to include("[section id=sec-1")
      expect(assembled.text).to include("[node Scoping] ← [material Lecture notes] section sec-1")
      expect(assembled.text).not_to include("← [material Lecture notes] section sec-2")
      expect(assembled.text).not_to include("sec-x")
      expect(described_class.estimate_tokens(assembled.text)).to be <= described_class.default_budget
    end

    it "with a mistake entry: the entry's question + its source section ride FIRST, then the plan scope" do
      node = create(:knowledge_node, user: user, plan: plan, title: "N", order: 1)
      material = create(:material, user: user, plan: plan, title: "M", sections: [
        { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." },
        long_section("sec-9", 40)
      ])
      question = create(:question, user: user, node: node, source_material: material,
                                   source_section_id: "sec-1", prompt: "How is every row scoped?")
      entry = create(:mistake_entry, user: user, question: question, node: node,
                                     user_answer: "by title",
                                     source_location: { "kind" => "markdown", "sectionId" => "sec-1" })

      assembled = described_class.plan_grounding(plan, mistake_entry: entry)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[mistake entry]")
      expect(assembled.text).to include("How is every row scoped?")
      expect(assembled.text).to include("by title")
      expect(assembled.text).to include("[section id=sec-1 title=\"Scoping\"]")
      expect(assembled.text).to include("Every row is scoped by user_id.")
      expect(assembled.text).to include("[nodes]")
      expect(assembled.text.index("[mistake entry]")).to be < assembled.text.index("[nodes]")
    end

    it "resolves the mistake's pdf source location to its page-N section (the companion resolver)" do
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan, kind: "pdf", title: "Slides", sections: [
        { "id" => "page-2", "title" => "Page 2", "text" => "second page content" }
      ])
      question = create(:question, user: user, node: node, source_material: material,
                                   source_section_id: "page-2", prompt: "What is on page 2?")
      entry = create(:mistake_entry, user: user, question: question, node: node,
                                     source_location: { "kind" => "pdf", "page" => 2 })

      assembled = described_class.plan_grounding(plan, mistake_entry: entry)

      expect(assembled.text).to include("[section id=page-2 title=\"Page 2\"]")
      expect(assembled.text).to include("second page content")
    end

    it "keeps assembling when the mistake's source section matches nothing (stale id)" do
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan, sections: [ long_section("sec-1", 30) ])
      question = create(:question, user: user, node: node, source_material: material,
                                   source_section_id: "sec-1", prompt: "Q?")
      entry = create(:mistake_entry, user: user, question: question, node: node,
                                     source_location: { "kind" => "markdown", "sectionId" => "missing" })

      assembled = described_class.plan_grounding(plan, mistake_entry: entry)

      expect(assembled.truncated).to be(false)
      expect(assembled.text).to include("[mistake entry]")
      expect(assembled.text).to include("[section id=sec-1") # the plan scope still rides
      expect(assembled.text).not_to include("missing")
    end

    it "drops the mapping block (truncated honest) when the budget cannot fit it" do
      node = create(:knowledge_node, user: user, plan: plan, title: "N", order: 1)
      material = create(:material, user: user, plan: plan, sections: [ long_section("s1", 900) ])
      create(:material_node_mapping, :confirmed, user: user, material: material, node: node, section_id: "s1")

      assembled = described_class.plan_grounding(plan, budget: 200)

      expect(assembled.truncated).to be(true)
      expect(described_class.estimate_tokens(assembled.text)).to be <= 200
      expect(assembled.text).not_to include("[confirmed mappings]")
    end

    it "keeps the never-exceeds-budget invariant when the mistake block is hard-cut" do
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan, sections: [ long_section("s1", 60) ])
      question = create(:question, user: user, node: node, source_material: material,
                                   source_section_id: "s1", prompt: ("q" * 4_000))
      entry = create(:mistake_entry, user: user, question: question, node: node,
                                     source_location: { "kind" => "markdown", "sectionId" => "s1" })

      assembled = described_class.plan_grounding(plan, mistake_entry: entry, budget: 150)

      expect(assembled.truncated).to be(true)
      expect(assembled.text).to include(Ai::ContextAssembler::TRUNCATION_MARKER)
      expect(described_class.estimate_tokens(assembled.text)).to be <= 150
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

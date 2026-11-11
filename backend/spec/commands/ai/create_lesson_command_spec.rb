# frozen_string_literal: true

require "rails_helper"

# Ai::CreateLessonCommand (epic-36 T1, spec decision 5 — the unified create):
# ② inputs plan+node+clientUuid (the outline is generated internally — ONE
# cap-counted call; an unmapped node refuses honestly BEFORE the call; the
# per-node lesson is a singleton — existing returns idempotently) and ①
# inputs material+echoed outline+clientUuid (NO provider call — the outline
# came from the propose gate; the echo is re-validated server-side; the
# per-source lesson is a singleton). Both shapes land the SAME row: a
# generated Material (origin=generated, kind=markdown, parse_state=parsed,
# no blob, sections empty) with generation.outline placeholders carrying
# server-side anchors. The client uuid keeps the delta-3 triad (same-user
# replay → the original row untouched, no call; foreign uuid →
# VALIDATION_FAILED; non-uuid → shape refusal).
RSpec.describe Ai::CreateLessonCommand do
  around do |example|
    keys = %w[AI_API_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["AI_API_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user, topic: "Distributed systems") }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Raft 选举", order: 0) }
  let(:source_material) do
    create(:material, user: user, plan: plan, parse_state: "parsed", title: "Distributed notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication passes writes down a chain" }
    ])
  end
  let(:mapping) do
    create(:material_node_mapping, :confirmed, user: user, material: source_material, node: node, section_id: "sec-1")
  end
  let(:adapter) { double("client") }
  let(:completions) { [] }

  before do
    source_material
    mapping
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      reply
    end
  end

  # The provider's outline reply for the ② path: two chapters over the
  # node's confirmed mapped sections.
  let(:reply) do
    { chapters: [
      { title: "选举与日志", sourceSectionIds: [ "sec-1" ] },
      { title: "凭空一章", sourceSectionIds: [ "ghost" ] }
    ] }.to_json
  end

  def call_node(plan_id: plan.id, node_id: node.id, language: "zh", client_uuid: SecureRandom.uuid)
    described_class.call(current_user: user, client_uuid: client_uuid, language: language,
                         plan_id: plan_id, node_id: node_id)
  end

  def echoed_outline
    [
      { title: "Raft 选举", source_section_ids: [ "sec-1" ] },
      { title: "链式复制", source_section_ids: [ "sec-2" ] }
    ]
  end

  def call_material(material_id: source_material.id, outline: echoed_outline, language: "zh", client_uuid: SecureRandom.uuid)
    described_class.call(current_user: user, client_uuid: client_uuid, language: language,
                         material_id: material_id, outline: outline)
  end

  shared_examples "the generated lesson row shape" do
    it "lands a generated Material: markdown, parsed, no blob, empty sections, outline placeholders with anchors" do
      lesson = lesson_material
      outline = lesson.generation["outline"]

      aggregate_failures do
        expect(lesson.origin).to eq("generated")
        expect(lesson.kind).to eq("markdown")
        expect(lesson.parse_state).to eq("parsed")
        expect(lesson.size_bytes).to eq(0)
        expect(lesson.sections).to eq([])
        expect(lesson.original.attached?).to be(false)
        expect(lesson.user_id).to eq(user.id)
        expect(lesson.generation["variant"]).to eq(variant)
        expect(outline).to be_present
        expect(outline.map { |chapter| chapter["status"] }).to all(eq("pending"))
        expect(outline.map { |chapter| chapter["id"] }).to eq(outline.each_with_index.map { |_chapter, index| "ch-#{index + 1}" })
        expect(lesson.generation["pausedKind"]).to be_nil
        expect(lesson.generation["generatedAt"]).to be_present
        expect(outline.flat_map { |chapter| chapter["anchors"] }).to all(
          include("materialId" => a_kind_of(String), "sectionId" => a_kind_of(String))
        )
      end
    end
  end

  describe "the node variant (②)" do
    let(:lesson_material) { call_node.value![:material] }
    let(:variant) { "node" }

    it_behaves_like "the generated lesson row shape"

    it "creates the lesson pinned to its node (attachment_scope=node) on the plan, one cap-counted call" do
      result = call_node

      aggregate_failures do
        expect(result).to be_success
        lesson = result.value![:material]
        expect(lesson.plan_id).to eq(plan.id)
        expect(lesson.node_id).to eq(node.id)
        expect(lesson.attachment_scope).to eq("node")
        expect(lesson.title).to eq(node.title)
        expect(lesson.id).to eq(lesson.generation["outline"] && lesson.id) # uuid lands as the row id
      end
      expect(completions.length).to eq(1)
      expect(AiUsageCounter.find_by(user: user).call_count).to eq(1)
    end

    it "grounds the outline on the node's confirmed mapped sections only, prompts in the node variant's tighter cap" do
      other = create(:material, user: user, plan: plan, title: "Plan-wide notes", sections: [
        { "id" => "o-1", "title" => "O", "text" => "plan-wide pool body" }
      ])
      other # plan-wide pool rides nothing here (the teaching-turn discipline)
      call_node

      prompt = completions.sole
      aggregate_failures do
        expect(prompt).to include("leader election and log replication")
        expect(prompt).not_to include("plan-wide pool body")
        expect(prompt).to include("At most #{Ai::Lessons::NODE_SECTION_MAX} chapters")
        expect(prompt).to include(node.title)
      end
    end

    it "keeps only chapters over CONFIRMED mapped sections and carries their material anchors" do
      lesson = call_node.value![:material]
      outline = lesson.generation["outline"]

      aggregate_failures do
        expect(outline.length).to eq(1) # the "凭空一章" chapter dropped (its id is not mapped)
        expect(outline.first["title"]).to eq("选举与日志")
        expect(outline.first["anchors"]).to eq([ { "materialId" => source_material.id, "sectionId" => "sec-1" } ])
      end
    end

    it "refuses an unmapped node with the honest reason BEFORE spending a call (VALIDATION_FAILED)" do
      lonely = create(:knowledge_node, user: user, plan: plan, title: "Lonely", order: 1)

      result = call_node(node_id: lonely.id)
      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:message]).to include("no confirmed material mapping")
      end
      expect(completions).to be_empty
    end

    it "answers the per-node singleton idempotently (existing lesson → returned, no call)" do
      first = call_node.value![:material]

      result = call_node(client_uuid: SecureRandom.uuid) # a different uuid — the node still owns one lesson
      aggregate_failures do
        expect(result).to be_success
        expect(result.value![:material].id).to eq(first.id)
      end
      expect(completions.length).to eq(1) # only the first creation called
    end

    it "keeps the delta-3 triad: same-user uuid replay returns the row untouched, foreign uuid refuses" do
      uuid = SecureRandom.uuid
      first = call_node(client_uuid: uuid).value![:material]

      replayed = call_node(client_uuid: uuid)
      expect(replayed.value![:material].id).to eq(first.id)
      expect(completions.length).to eq(1) # no second call on replay

      foreign = create(:user)
      foreign_plan = create(:study_plan, user: foreign)
      foreign_node = create(:knowledge_node, user: foreign, plan: foreign_plan)
      foreign_call = described_class.call(current_user: foreign, client_uuid: uuid, language: "zh",
                                          plan_id: foreign_plan.id, node_id: foreign_node.id)
      expect(foreign_call.failure.code).to eq(:VALIDATION_FAILED)

      expect(call_node(client_uuid: "not-a-uuid").failure.code).to eq(:VALIDATION_FAILED)
    end

    it "answers uniform NOT_FOUND for foreign/malformed plan or node ids" do
      foreign_plan = create(:study_plan)
      foreign_node = create(:knowledge_node, plan: foreign_plan)

      expect(call_node(plan_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call_node(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
      expect(call_node(node_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call_node(node_id: foreign_node.id).failure.code).to eq(:NOT_FOUND) # a node of another plan
      expect(completions).to be_empty
    end

    it "answers NOT_FOUND for a task node (plan-scoped ownership — a task scopes through its material)" do
      task = create(:study_task, user: user, material: source_material)
      task_node = task.node

      expect(call_node(node_id: task_node.id).failure.code).to eq(:NOT_FOUND)
      expect(completions).to be_empty
    end

    it "answers INTERNAL when the reply normalizes to zero mapped chapters (the cap was still spent)" do
      allow(adapter).to receive(:complete) do |messages|
        completions << messages.map { |message| message[:content] }.join
        { chapters: [ { title: "凭空", sourceSectionIds: [ "ghost" ] } ] }.to_json
      end

      result = call_node
      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
      end
      expect(completions.length).to eq(1)
    end

    it "carries CAP_REACHED through from the seam untouched" do
      create(:ai_usage_counter, user: user, call_count: 50)

      expect(call_node.failure.code).to eq(:CAP_REACHED)
    end
  end

  describe "the material variant (①)" do
    let(:lesson_material) { call_material.value![:material] }
    let(:variant) { "material" }

    it_behaves_like "the generated lesson row shape"

    it "creates the lesson from the echoed outline with NO provider call" do
      result = call_material

      aggregate_failures do
        expect(result).to be_success
        lesson = result.value![:material]
        expect(lesson.title).to eq(source_material.title)
        expect(lesson.attachment_scope).to eq("plan")
        expect(lesson.node_id).to be_nil
        # The lesson follows its source's plan attachment (nil when the
        # source is unattached/task-attached — the row stays a standalone
        # material either way).
        expect(lesson.plan_id).to eq(source_material.plan_id)
      end
      expect(completions).to be_empty
      expect(AiUsageCounter.find_by(user: user)).to be_nil
    end

    it "carries the echoed chapters as placeholders anchored to the source material" do
      outline = call_material.value![:material].generation["outline"]

      aggregate_failures do
        expect(outline.map { |chapter| chapter["title"] }).to eq([ "Raft 选举", "链式复制" ])
        expect(outline.first["anchors"]).to eq([ { "materialId" => source_material.id, "sectionId" => "sec-1" } ])
        expect(outline.second["anchors"]).to eq([ { "materialId" => source_material.id, "sectionId" => "sec-2" } ])
      end
    end

    it "validates the echo: >8 chapters, duplicate titles, unknown sections, empty/absent — all VALIDATION_FAILED" do
      over = (1..9).map { |n| { title: "第#{n}章", source_section_ids: [ "sec-1" ] } }
      expect(call_material(outline: over).failure.code).to eq(:VALIDATION_FAILED)

      dupe = [ { title: "同名", source_section_ids: [ "sec-1" ] }, { title: " 同名 ", source_section_ids: [ "sec-2" ] } ]
      expect(call_material(outline: dupe).failure.code).to eq(:VALIDATION_FAILED)

      expect(call_material(outline: [ { title: "凭空", source_section_ids: [ "ghost" ] } ]).failure.code).to eq(:VALIDATION_FAILED)
      expect(call_material(outline: [ { title: "无源", source_section_ids: [] } ]).failure.code).to eq(:VALIDATION_FAILED)
      expect(call_material(outline: []).failure.code).to eq(:VALIDATION_FAILED)
      expect(call_material(outline: nil).failure.code).to eq(:VALIDATION_FAILED)
      expect(call_material(outline: "chapters").failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end

    it "accepts the propose output echoed verbatim (camelCase keys — the wire shape)" do
      wire_shape = [ { "title" => "Raft 选举", "sourceSectionIds" => [ "sec-1" ] } ]

      result = call_material(outline: wire_shape)
      expect(result).to be_success
    end

    it "answers the per-source singleton idempotently (existing lesson → returned, still no call)" do
      first = call_material.value![:material]

      result = call_material(client_uuid: SecureRandom.uuid)
      expect(result.value![:material].id).to eq(first.id)
      expect(completions).to be_empty
    end

    it "keeps the delta-3 triad on the material variant too" do
      uuid = SecureRandom.uuid
      first = call_material(client_uuid: uuid).value![:material]

      expect(call_material(client_uuid: uuid).value![:material].id).to eq(first.id)

      foreign = create(:user)
      foreign_call = described_class.call(current_user: foreign, client_uuid: uuid, language: "zh",
                                          material_id: create(:material, user: foreign, parse_state: "parsed",
                                                              sections: [ { "id" => "s", "title" => "S", "text" => "t" } ]).id,
                                          outline: [ { title: "章", source_section_ids: [ "s" ] } ])
      expect(foreign_call.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "refuses a generated lesson as the source and an unparsed source (VALIDATION_FAILED before anything)" do
      lesson = create(:material, user: user, origin: "generated", parse_state: "parsed", sections: source_material.sections)
      expect(call_material(material_id: lesson.id,
                           outline: [ { title: "章", source_section_ids: [ "sec-1" ] } ]).failure.code).to eq(:VALIDATION_FAILED)

      unparsed = create(:material, user: user, parse_state: "pending")
      expect(call_material(material_id: unparsed.id,
                           outline: [ { title: "章", source_section_ids: [ "sec-1" ] } ]).failure.code).to eq(:VALIDATION_FAILED)
    end

    it "answers uniform NOT_FOUND for foreign/malformed source ids and refuses shape mixing" do
      foreign = create(:material, parse_state: "parsed", sections: source_material.sections)

      expect(call_material(material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call_material(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
      everything = described_class.call(current_user: user, client_uuid: SecureRandom.uuid, language: "zh",
                                        plan_id: plan.id, node_id: node.id, material_id: source_material.id,
                                        outline: echoed_outline)
      expect(everything.failure.code).to eq(:VALIDATION_FAILED)
      mixed = described_class.call(current_user: user, client_uuid: SecureRandom.uuid, language: "zh",
                                   plan_id: plan.id, node_id: node.id, material_id: source_material.id)
      expect(mixed.failure.code).to eq(:VALIDATION_FAILED)
      expect(described_class.call(current_user: user, client_uuid: SecureRandom.uuid, language: "zh").failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end
  end

  it "refuses an invalid language on both shapes before anything happens" do
    expect(call_node(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(call_material(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(completions).to be_empty
  end
end

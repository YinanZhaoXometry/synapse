# frozen_string_literal: true

require "rails_helper"

# Ai::MapMaterialSectionsCommand (epic P2-10 T1, FR-45) against a stubbed
# adapter — the coverage contract: every section lands in exactly one final
# state (mapped → proposed-with-node, gap → proposed-with-title, truly
# out-of-scope → the explicit Unmapped row); confirmed rows are never
# overwritten, rejected sections are never re-proposed, and the run is
# cap-counted through the AD-16 seam.
RSpec.describe Ai::MapMaterialSectionsCommand do
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
  let(:node_a) { create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0) }
  let(:node_b) { create(:knowledge_node, user: user, plan: plan, title: "Replication", order: 1) }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication explained" },
      { "id" => "sec-3", "title" => "Recipes", "text" => "cooking recipes, entirely off topic" }
    ])
  end
  let(:adapter) { double("client") }

  before do
    node_a
    node_b
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def call(material_id: material.id, language: "zh")
    described_class.call(current_user: user, material_id: material_id, language: language)
  end

  it "maps every section into exactly one proposed row — node, gap title, or Unmapped (FR-45)" do
    allow(adapter).to receive(:complete).and_return({
      mappings: [
        { sectionId: "sec-1", nodeId: node_a.id, proposedNodeTitle: nil },
        { sectionId: "sec-2", nodeId: nil, proposedNodeTitle: "Chain replication" },
        { sectionId: "sec-3", nodeId: nil, proposedNodeTitle: nil }
      ]
    }.to_json)

    result = call
    expect(result).to be_success
    rows = result.value![:mappings]
    expect(rows.map(&:section_id)).to eq(%w[sec-1 sec-2 sec-3]) # document order, nothing dropped
    expect(rows.map(&:status).uniq).to eq(%w[proposed])
    expect(rows[0].node_id).to eq(node_a.id)
    expect(rows[0].proposed_node_title).to be_nil
    expect(rows[1].node_id).to be_nil
    expect(rows[1].proposed_node_title).to eq("Chain replication")
    expect(rows[2].node_id).to be_nil
    expect(rows[2].proposed_node_title).to be_nil # the explicit Unmapped row
    expect(user.ai_usage_counters.sole.call_count).to eq(1) # cap-counted through the seam
  end

  it "is idempotent in place: a re-run updates open rows in place — never duplicates" do
    allow(adapter).to receive(:complete).and_return({
      mappings: [
        { sectionId: "sec-1", nodeId: node_b.id, proposedNodeTitle: nil },
        { sectionId: "sec-2", nodeId: nil, proposedNodeTitle: "Chain replication" }
      ]
    }.to_json)
    first = call
    expect(first).to be_success
    first_rows = first.value![:mappings].index_by(&:section_id)

    # The re-run's reply governs the still-open sections: sec-1 moves to a
    # different node, sec-2 gets no entry this time (no confident mapping →
    # the explicit Unmapped row, FR-45), and sec-3 was never addressed.
    allow(adapter).to receive(:complete).and_return({
      mappings: [ { sectionId: "sec-1", nodeId: node_a.id, proposedNodeTitle: nil } ]
    }.to_json)
    second = call
    expect(second).to be_success
    rows = second.value![:mappings].index_by(&:section_id)
    expect(rows["sec-1"].id).to eq(first_rows["sec-1"].id) # the SAME row, updated in place
    expect(rows["sec-1"].node_id).to eq(node_a.id)
    expect(rows["sec-2"].id).to eq(first_rows["sec-2"].id) # same row, demoted to Unmapped
    expect(rows["sec-2"].proposed_node_title).to be_nil
    expect(rows["sec-2"].node_id).to be_nil
    expect(rows["sec-3"].status).to eq("proposed")
    expect(user.material_node_mappings.count).to eq(3) # one active row per section — never duplicated
  end

  it "never re-proposes a rejected section and never overwrites a confirmed row" do
    rejected = create(:material_node_mapping, :rejected, user: user, material: material, section_id: "sec-1")
    confirmed = create(:material_node_mapping, :confirmed, user: user, material: material,
                                                           section_id: "sec-2", node: node_b)

    allow(adapter).to receive(:complete).and_return({
      mappings: [
        { sectionId: "sec-1", nodeId: node_a.id, proposedNodeTitle: nil },
        { sectionId: "sec-2", nodeId: node_a.id, proposedNodeTitle: nil },
        { sectionId: "sec-3", nodeId: nil, proposedNodeTitle: nil }
      ]
    }.to_json)

    result = call
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:section_id)
    expect(rows["sec-1"].id).to eq(rejected.id)
    expect(rows["sec-1"].reload.status).to eq("rejected") # untouched — never re-proposed
    expect(rows["sec-2"].id).to eq(confirmed.id)
    expect(rows["sec-2"].reload.status).to eq("confirmed") # untouched — never overwritten
    expect(rows["sec-2"].reload.node_id).to eq(node_b.id)
    expect(rows["sec-3"].status).to eq("proposed") # the still-coverable section gets its row
  end

  it "drops hallucinated node ids and garbage entries to the Unmapped group, still covering the section" do
    allow(adapter).to receive(:complete).and_return({
      mappings: [
        { sectionId: "sec-1", nodeId: SecureRandom.uuid, proposedNodeTitle: nil }, # foreign node id
        { sectionId: "sec-2", nodeId: node_a.id, proposedNodeTitle: "also a title" }, # nodeId wins
        "garbage",
        { sectionId: "not-a-section", nodeId: node_a.id, proposedNodeTitle: nil } # unknown address
      ]
    }.to_json)

    result = call
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:section_id)
    expect(rows["sec-1"].node_id).to be_nil # unmapped, not silently dropped
    expect(rows["sec-1"].proposed_node_title).to be_nil
    expect(rows["sec-2"].node_id).to eq(node_a.id)
    expect(rows["sec-2"].proposed_node_title).to be_nil
  end

  it "fails INTERNAL on a reply without parseable mappings" do
    allow(adapter).to receive(:complete).and_return("no json here")
    expect(call.failure.code).to eq(:INTERNAL)
  end

  it "refuses unknown/foreign materials and bad languages before spending a call" do
    allow(adapter).to receive(:complete)
    other = create(:user)
    foreign = create(:material, user: other, plan: create(:study_plan, user: other))

    expect(call(material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
    expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
  end

  it "refuses a material with no parsed sections (nothing to map)" do
    empty = create(:material, user: user, plan: plan, sections: [])
    expect(call(material_id: empty.id).failure.code).to eq(:VALIDATION_FAILED)
  end

  it "refuses a material attached to no plan (mapping targets the plan's nodes)" do
    loose = create(:material, user: user)
    expect(call(material_id: loose.id).failure.code).to eq(:VALIDATION_FAILED)
  end
end

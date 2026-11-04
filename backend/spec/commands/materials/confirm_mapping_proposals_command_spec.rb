# frozen_string_literal: true

require "rails_helper"

# Materials::ConfirmMappingProposalsCommand (epic P2-10 T1, FR-45): bulk
# confirm of proposed mapping rows. A group of rows sharing a
# proposed_node_title creates ONE real plan-scoped KnowledgeNode (order =
# max+1, title-deduped against the plan's existing nodes) and flips the whole
# group to confirmed with that node_id; rows already decided return
# unchanged; cross-user/unknown ids are uniformly NOT_FOUND (delta 2).
RSpec.describe Materials::ConfirmMappingProposalsCommand do
  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user, topic: "Distributed systems") }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication" },
      { "id" => "sec-3", "title" => "Gossip", "text" => "gossip protocols" }
    ])
  end
  let(:existing_node) { create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0) }

  before { existing_node }

  # Two gap rows under one proposed title + one row already pointed at an
  # existing node + one decided row.
  let(:gap_a) do
    create(:material_node_mapping, user: user, material: material, section_id: "sec-1",
                                   proposed_node_title: "Failure detection")
  end
  let(:gap_b) do
    create(:material_node_mapping, user: user, material: material, section_id: "sec-2",
                                   proposed_node_title: "Failure detection")
  end
  let(:onto_existing) do
    create(:material_node_mapping, user: user, material: material, section_id: "sec-3", node: existing_node)
  end
  let(:already_confirmed) do
    create(:material_node_mapping, :confirmed, user: user, material: material, section_id: "sec-9", node: existing_node)
  end

  def call(mapping_ids)
    described_class.call(current_user: user, mapping_ids: mapping_ids)
  end

  it "creates ONE node per proposed-title group and flips every row of the group to confirmed" do
    result = call([ gap_a.id, gap_b.id, onto_existing.id ])
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:id)

    created = KnowledgeNode.where(plan_id: plan.id, title: "Failure detection")
    expect(created.count).to eq(1) # ONE node for the group, not one per row
    node = created.sole
    expect(node.user_id).to eq(user.id)
    expect(node.stage).to be_nil
    expect(node.order).to eq(1) # max order (0) + 1

    expect(rows[gap_a.id].reload.status).to eq("confirmed")
    expect(rows[gap_a.id].reload.node_id).to eq(node.id)
    expect(rows[gap_b.id].reload.status).to eq("confirmed")
    expect(rows[gap_b.id].reload.node_id).to eq(node.id)
    expect(rows[onto_existing.id].reload.status).to eq("confirmed") # pointed rows just flip
    expect(rows[onto_existing.id].reload.node_id).to eq(existing_node.id)
  end

  it "dedupes against the plan's existing nodes — a confirmed title matching a node reuses it" do
    create(:knowledge_node, user: user, plan: plan, title: "Failure detection", order: 2)

    result = call([ gap_a.id, gap_b.id ])
    expect(result).to be_success
    node = KnowledgeNode.where(plan_id: plan.id, title: "Failure detection").sole
    expect(result.value![:mappings].map(&:node_id).uniq).to eq([ node.id ])
    expect(KnowledgeNode.where(plan_id: plan.id, title: "Failure detection").count).to eq(1)
  end

  it "assigns consecutive orders when several groups confirm in one call" do
    other_gap = create(:material_node_mapping, user: user, material: material, section_id: "sec-3",
                                               proposed_node_title: "Gossip protocols")
    result = call([ gap_a.id, gap_b.id, other_gap.id ])
    expect(result).to be_success

    node_orders = KnowledgeNode.where(plan_id: plan.id)
                               .where(title: [ "Failure detection", "Gossip protocols" ])
                               .order(:order).pluck(:order)
    expect(node_orders).to eq([ 1, 2 ])
  end

  it "returns decided rows unchanged (confirmed stays confirmed, rejected stays rejected)" do
    rejected = create(:material_node_mapping, :rejected, user: user, material: material, section_id: "sec-4",
                                                         proposed_node_title: "Was rejected once")

    result = call([ already_confirmed.id, rejected.id ])
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:id)
    expect(rows[already_confirmed.id].reload.status).to eq("confirmed")
    expect(rows[rejected.id].reload.status).to eq("rejected") # never resurrected by confirm
    expect(KnowledgeNode.where(plan_id: plan.id, title: "Was rejected once").count).to eq(0)
  end

  it "fails NOT_FOUND for unknown, malformed, or foreign ids — nothing changes" do
    other = create(:user)
    other_material = create(:material, user: other, plan: create(:study_plan, user: other))
    foreign = create(:material_node_mapping, user: other, material: other_material, section_id: "sec-1")

    [ SecureRandom.uuid, "not-a-uuid", foreign.id ].each do |bad_id|
      expect(call([ gap_a.id, bad_id ]).failure.code).to eq(:NOT_FOUND)
    end
    expect(gap_a.reload.status).to eq("proposed")
    expect(KnowledgeNode.where(plan_id: plan.id, title: "Failure detection").count).to eq(0)
  end

  it "refuses an empty id list" do
    expect(call([]).failure.code).to eq(:VALIDATION_FAILED)
  end

  it "refuses rows whose material detached from its plan (no node target exists)" do
    loose = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "T", "text" => "x" } ])
    row = create(:material_node_mapping, user: user, material: loose, section_id: "sec-1",
                                         proposed_node_title: "Nowhere node")
    expect(call([ row.id ]).failure.code).to eq(:VALIDATION_FAILED)
  end
end

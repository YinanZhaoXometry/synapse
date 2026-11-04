# frozen_string_literal: true

require "rails_helper"

# Materials::RejectMappingProposalsCommand (epic P2-10 T1, FR-45): bulk
# reject of proposed mapping rows. Rejected rows persist with status
# `rejected` (the map run never re-proposes them); rows already decided
# return unchanged; cross-user/unknown ids are uniformly NOT_FOUND (delta 2).
RSpec.describe Materials::RejectMappingProposalsCommand do
  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user, topic: "Distributed systems") }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication" }
    ])
  end
  let(:gap_a) do
    create(:material_node_mapping, user: user, material: material, section_id: "sec-1",
                                   proposed_node_title: "Failure detection")
  end
  let(:onto_existing) do
    create(:material_node_mapping, user: user, material: material, section_id: "sec-2",
                                   node: create(:knowledge_node, user: user, plan: plan))
  end

  def call(mapping_ids)
    described_class.call(current_user: user, mapping_ids: mapping_ids)
  end

  it "flips proposed rows to rejected in place, keeping their proposal state" do
    result = call([ gap_a.id, onto_existing.id ])
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:id)

    expect(rows[gap_a.id].reload.status).to eq("rejected")
    expect(rows[gap_a.id].reload.proposed_node_title).to eq("Failure detection")
    expect(rows[gap_a.id].reload.node_id).to be_nil
    expect(rows[onto_existing.id].reload.status).to eq("rejected")
  end

  it "returns decided rows unchanged" do
    confirmed = create(:material_node_mapping, :confirmed, user: user, material: material, section_id: "sec-9")
    rejected = create(:material_node_mapping, :rejected, user: user, material: material, section_id: "sec-8")

    result = call([ confirmed.id, rejected.id ])
    expect(result).to be_success
    rows = result.value![:mappings].index_by(&:id)
    expect(rows[confirmed.id].reload.status).to eq("confirmed")
    expect(rows[rejected.id].reload.status).to eq("rejected")
  end

  it "fails NOT_FOUND for unknown, malformed, or foreign ids — nothing changes" do
    other = create(:user)
    foreign = create(:material_node_mapping, user: other,
                                             material: create(:material, user: other), section_id: "sec-1")

    [ SecureRandom.uuid, "not-a-uuid", foreign.id ].each do |bad_id|
      expect(call([ gap_a.id, bad_id ]).failure.code).to eq(:NOT_FOUND)
    end
    expect(gap_a.reload.status).to eq("proposed")
  end

  it "refuses an empty id list" do
    expect(call([]).failure.code).to eq(:VALIDATION_FAILED)
  end
end

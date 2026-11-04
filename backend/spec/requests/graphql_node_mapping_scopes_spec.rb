# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL materialNodeMappings scoping (epic P2-10 T3, FR-45/FR-6)", type: :request do
  # The mapping read gains its node side (FR-6's click-through needs a node's
  # confirmed mappings): exactly one of materialId / nodeId (the flashcards
  # xor precedent), the nodeId side user-scoped through the caller's own node
  # association path (AD-13 — uniform NOT_FOUND for foreign/malformed ids,
  # kickoff delta 2). The materialId side is unchanged. Direct GraphQL over
  # HTTP (AD-10, the epic-02 request-spec pattern); the commands underneath
  # have their own direct specs.
  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node_a) { create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0) }
  let(:material) { create(:material, user: user, plan: plan) }

  def query_mappings(token, variables)
    graphql(
      <<~GRAPHQL, variables: variables, token: token
        query Mappings($materialId: String, $nodeId: String) {
          materialNodeMappings(materialId: $materialId, nodeId: $nodeId) {
            id materialId nodeId sectionId status createdAt
          }
        }
      GRAPHQL
    )
  end

  it "answers the node's rows (every status — the frontend filters confirmed) and nothing of other nodes" do
    owner, token = user_with_token("node-mapping-owner@example.com")
    owner_plan = create(:study_plan, user: owner)
    owner_node = create(:knowledge_node, user: owner, plan: owner_plan, title: "Gossip", order: 0)
    other_node = create(:knowledge_node, user: owner, plan: owner_plan, title: "Other", order: 1)
    owner_material = create(:material, user: owner, plan: owner_plan)
    create(:material_node_mapping, user: owner, material: owner_material, node: owner_node, section_id: "sec-1")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: owner_node, section_id: "sec-2")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: other_node, section_id: "sec-3")

    result = query_mappings(token, { nodeId: owner_node.id })
    rows = result.dig("data", "materialNodeMappings")
    expect(rows.length).to eq(2)
    expect(rows.map { |r| r["sectionId"] }).to eq(%w[sec-1 sec-2]) # (created_at, id) order
    expect(rows.map { |r| r["nodeId"] }.uniq).to eq([ owner_node.id ])
    expect(rows.map { |r| r["materialId"] }.uniq).to eq([ owner_material.id ])
    expect(rows.map { |r| r["status"] }).to include("proposed", "confirmed")
  end

  it "answers the materialId side unchanged (the coverage panel's read)" do
    owner, token = user_with_token("material-mapping-owner@example.com")
    owner_plan = create(:study_plan, user: owner)
    owner_node = create(:knowledge_node, user: owner, plan: owner_plan, title: "Consensus", order: 0)
    owner_material = create(:material, user: owner, plan: owner_plan)
    create(:material_node_mapping, user: owner, material: owner_material, node: owner_node, section_id: "sec-1")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: owner_node, section_id: "sec-2")

    result = query_mappings(token, { materialId: owner_material.id })
    rows = result.dig("data", "materialNodeMappings")
    expect(rows.length).to eq(2)
    expect(rows.map { |r| r["sectionId"] }).to eq(%w[sec-1 sec-2])
    expect(rows.map { |r| r["status"] }).to include("proposed", "confirmed")
  end

  it "refuses both scopes with VALIDATION_FAILED (the xor, the flashcards precedent)" do
    node_a
    _user, token = user_with_token("mapping-xor@example.com")
    result = query_mappings(token, { materialId: material.id, nodeId: node_a.id })
    expect(error_code(result)).to eq("VALIDATION_FAILED")
    expect(result.dig("data", "materialNodeMappings")).to be_nil
  end

  it "refuses the unscoped read with VALIDATION_FAILED (exactly one scope is required)" do
    _user, token = user_with_token("mapping-unscoped@example.com")
    result = query_mappings(token, {})
    expect(error_code(result)).to eq("VALIDATION_FAILED")
    expect(result.dig("data", "materialNodeMappings")).to be_nil
  end

  it "answers uniform NOT_FOUND for a foreign node id (never reveals existence)" do
    node_a
    _user, token = user_with_token("mapping-foreign@example.com")
    result = query_mappings(token, { nodeId: node_a.id }) # node_a belongs to `user`, not the tokened caller
    expect(error_code(result)).to eq("NOT_FOUND")
    expect(result.dig("data", "materialNodeMappings")).to be_nil
  end

  it "answers uniform NOT_FOUND for a malformed node id" do
    _user, token = user_with_token("mapping-malformed@example.com")
    result = query_mappings(token, { nodeId: "not-a-uuid" })
    expect(error_code(result)).to eq("NOT_FOUND")
  end

  it "answers UNAUTHORIZED without a token" do
    node_a
    result = query_mappings(nil, { nodeId: node_a.id })
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end
end

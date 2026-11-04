# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL planNodeMappings (epic P2-10 T4, FR-5/FR-7)", type: :request do
  # The plan-scope batch read (the T4 binding carried from T3's review: the
  # per-row materialNodeMappings(nodeId:) read is an eager N+1 at the 30+ node
  # bar). One query answers every node-attached mapping row of ONE plan —
  # every status rides (the wire's one mapping-list vocabulary, T3's
  # precedent; the consumer filters confirmed). User-scoped through the
  # caller's own association paths (AD-13): foreign/malformed plan ids are
  # uniformly NOT_FOUND (kickoff delta 2). Rows attached to NO node (the gap
  # proposals / unmapped rows, node_id nil) serve no node surface and are
  # excluded. Direct GraphQL over HTTP (AD-10, the epic-02 request-spec
  # pattern).
  def query_mappings(token, variables)
    graphql(
      <<~GRAPHQL, variables: variables, token: token
        query PlanMappings($planId: String!) {
          planNodeMappings(planId: $planId) {
            id materialId nodeId sectionId status createdAt
          }
        }
      GRAPHQL
    )
  end

  it "answers every node-attached row of the plan (all statuses) and nothing of other plans" do
    owner, token = user_with_token("plan-mapping-owner@example.com")
    owner_plan = create(:study_plan, user: owner)
    other_plan = create(:study_plan, user: owner)
    node_a = create(:knowledge_node, user: owner, plan: owner_plan, title: "Consensus", order: 0)
    node_b = create(:knowledge_node, user: owner, plan: owner_plan, title: "Gossip", order: 1)
    other_node = create(:knowledge_node, user: owner, plan: other_plan, title: "Elsewhere", order: 0)
    owner_material = create(:material, user: owner, plan: owner_plan)
    create(:material_node_mapping, user: owner, material: owner_material, node: node_a, section_id: "sec-1")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: node_a, section_id: "sec-2")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: node_b, section_id: "sec-3")
    create(:material_node_mapping, :rejected, user: owner, material: owner_material, node: node_b, section_id: "sec-4")
    create(:material_node_mapping, :confirmed, user: owner, material: owner_material, node: other_node, section_id: "sec-9")

    result = query_mappings(token, { planId: owner_plan.id })
    rows = result.dig("data", "planNodeMappings")
    expect(rows.length).to eq(4) # the other plan's row is not the plan's
    expect(rows.map { |r| r["nodeId"] }.uniq).to contain_exactly(node_a.id, node_b.id)
    expect(rows.map { |r| r["sectionId"] }).to eq(%w[sec-1 sec-2 sec-3 sec-4]) # (created_at, id) order
    expect(rows.map { |r| r["status"] }).to include("proposed", "confirmed", "rejected")
  end

  it "excludes the node-less rows (gap proposals / unmapped — no node surface consumes them)" do
    owner, token = user_with_token("plan-mapping-gap@example.com")
    owner_plan = create(:study_plan, user: owner)
    node_a = create(:knowledge_node, user: owner, plan: owner_plan, title: "Consensus", order: 0)
    owner_material = create(:material, user: owner, plan: owner_plan)
    create(:material_node_mapping, user: owner, material: owner_material, node: node_a, section_id: "sec-1")
    create(:material_node_mapping, user: owner, material: owner_material, node: nil,
                                   proposed_node_title: "A missing chapter", section_id: "sec-gap")

    result = query_mappings(token, { planId: owner_plan.id })
    rows = result.dig("data", "planNodeMappings")
    expect(rows.length).to eq(1)
    expect(rows.first["nodeId"]).to eq(node_a.id)
  end

  it "answers uniform NOT_FOUND for a foreign plan id (never reveals existence)" do
    owner, token = user_with_token("plan-mapping-foreign@example.com")
    foreign_plan = create(:study_plan, user: create(:user))
    node_a = create(:knowledge_node, user: owner, plan: foreign_plan, title: "Not mine", order: 0)

    result = query_mappings(token, { planId: foreign_plan.id })
    expect(error_code(result)).to eq("NOT_FOUND")
    expect(result.dig("data", "planNodeMappings")).to be_nil
    expect(node_a).to be_present # the foreign graph exists but is unreachable
  end

  it "answers uniform NOT_FOUND for a malformed plan id" do
    _user, token = user_with_token("plan-mapping-malformed@example.com")
    result = query_mappings(token, { planId: "not-a-uuid" })
    expect(error_code(result)).to eq("NOT_FOUND")
  end

  it "answers UNAUTHORIZED without a token" do
    plan = create(:study_plan, user: create(:user))
    result = query_mappings(nil, { planId: plan.id })
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end
end

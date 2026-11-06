# frozen_string_literal: true

require "rails_helper"

# The three mapping mutations over the wire (epic P2-10 T1's ops; epic P3-17
# ticket 06 closed the wire gap — these were the only mutations exercised
# only at the command layer). The commands underneath have their own direct
# specs (spec/commands/ai/map_material_sections_command_spec.rb,
# spec/commands/materials/confirm|reject_mapping_proposals_command_spec.rb);
# the concern here is the HTTP contract itself: the auth guard, argument
# coercion, payload shape, and the closed-enum failure codes.
RSpec.describe "GraphQL material mapping ops over the wire", type: :request do
  # mapMaterialSections is a cap-counted server AI mutation — the same ENV
  # posture as the other AI mutation specs (PROVIDER_KEY forces the seam
  # configured; AI_DAILY_CALL_CAP defaults).
  around do |example|
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token on all three mapping mutations" do
      uuid = SecureRandom.uuid
      mutations = [
        "mutation { mapMaterialSections(input: { materialId: \"#{uuid}\", language: \"zh\" }) { mappings { id } } }",
        "mutation { confirmMappingProposals(input: { mappingIds: [\"#{uuid}\"] }) { mappings { id } } }",
        "mutation { rejectMappingProposals(input: { mappingIds: [\"#{uuid}\"] }) { mappings { id } } }"
      ]
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "mapMaterialSections" do
    it "maps the material's sections over the wire and rides the cap seam" do
      user, token = user_with_token("mapping-map@example.com")
      plan = create(:study_plan, user: user, topic: "Distributed systems")
      node = create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0)
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Raft", "text" => "leader election" },
        { "id" => "sec-2", "title" => "Chains", "text" => "chain replication" },
        { "id" => "sec-3", "title" => "Recipes", "text" => "off topic" }
      ])
      allow(adapter).to receive(:complete).and_return({
        mappings: [
          { sectionId: "sec-1", nodeId: node.id, proposedNodeTitle: nil },
          { sectionId: "sec-2", nodeId: nil, proposedNodeTitle: "Chain replication" },
          { sectionId: "sec-3", nodeId: nil, proposedNodeTitle: nil }
        ]
      }.to_json)

      result = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, language: "zh" } }, token: token
          mutation MapMaterialSections($input: MapMaterialSectionsInput!) {
            mapMaterialSections(input: $input) {
              mappings { id sectionId status nodeId proposedNodeTitle materialId }
            }
          }
        GRAPHQL
      )
      rows = result.dig("data", "mapMaterialSections", "mappings")
      aggregate_failures do
        expect(rows.map { |r| r["sectionId"] }).to eq(%w[sec-1 sec-2 sec-3]) # document order
        expect(rows.map { |r| r["status"] }.uniq).to eq(%w[proposed])
        expect(rows[0]["nodeId"]).to eq(node.id)
        expect(rows[1]["nodeId"]).to be_nil
        expect(rows[1]["proposedNodeTitle"]).to eq("Chain replication")
        expect(rows[2]["proposedNodeTitle"]).to be_nil # the explicit Unmapped row
        expect(rows.find { |r| r["sectionId"] == "sec-1" }["materialId"]).to eq(material.id)
      end
      expect(user.ai_usage_counters.sole.call_count).to eq(1) # cap-counted through the seam
    end

    it "answers NOT_FOUND for a foreign material without spending the call" do
      user, token = user_with_token("mapping-map-foreign@example.com")
      other = create(:user)
      foreign = create(:material, user: other, plan: create(:study_plan, user: other),
                                  sections: [ { "id" => "sec-1", "title" => "S", "text" => "b" } ])
      allow(adapter).to receive(:complete)

      result = graphql(
        "mutation { mapMaterialSections(input: { materialId: \"#{foreign.id}\", language: \"zh\" }) " \
          "{ mappings { id } } }",
        token: token
      )

      expect(error_code(result)).to eq("NOT_FOUND")
      expect(adapter).not_to have_received(:complete)
      expect(user.ai_usage_counters).to be_empty
    end

    it "carries the command's VALIDATION_FAILED legs through the closed enum" do
      user, token = user_with_token("mapping-map-validation@example.com")
      plan = create(:study_plan, user: user)
      no_sections = create(:material, user: user, plan: plan, sections: [])
      no_plan = create(:material, user: user)

      bad_language = graphql(
        "mutation { mapMaterialSections(input: { materialId: \"#{create(:material, user: user, plan: plan).id}\", " \
          "language: \"fr\" }) { mappings { id } } }",
        token: token
      )
      expect(error_code(bad_language)).to eq("VALIDATION_FAILED")

      empty_result = graphql(
        "mutation { mapMaterialSections(input: { materialId: \"#{no_sections.id}\", language: \"zh\" }) " \
          "{ mappings { id } } }",
        token: token
      )
      expect(error_code(empty_result)).to eq("VALIDATION_FAILED")

      detached = graphql(
        "mutation { mapMaterialSections(input: { materialId: \"#{no_plan.id}\", language: \"zh\" }) " \
          "{ mappings { id } } }",
        token: token
      )
      expect(error_code(detached)).to eq("VALIDATION_FAILED")
    end
  end

  describe "confirmMappingProposals" do
    it "creates ONE node for a proposed-title group and returns the confirmed rows" do
      user, token = user_with_token("mapping-confirm@example.com")
      plan = create(:study_plan, user: user, topic: "Distributed systems")
      existing = create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0)
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Raft", "text" => "leader election" },
        { "id" => "sec-2", "title" => "Chains", "text" => "chain replication" },
        { "id" => "sec-3", "title" => "Gossip", "text" => "gossip protocols" }
      ])
      gap_a = create(:material_node_mapping, user: user, material: material, section_id: "sec-1",
                                             proposed_node_title: "Failure detection")
      gap_b = create(:material_node_mapping, user: user, material: material, section_id: "sec-2",
                                             proposed_node_title: "Failure detection")
      onto_existing = create(:material_node_mapping, user: user, material: material, section_id: "sec-3",
                                                     node: existing)

      result = graphql(
        <<~GRAPHQL, variables: { input: { mappingIds: [ gap_a.id, gap_b.id, onto_existing.id ] } }, token: token
          mutation ConfirmMappingProposals($input: ConfirmMappingProposalsInput!) {
            confirmMappingProposals(input: $input) {
              mappings { id status nodeId proposedNodeTitle }
            }
          }
        GRAPHQL
      )
      rows = result.dig("data", "confirmMappingProposals", "mappings").index_by { |r| r["id"] }
      aggregate_failures do
        expect(rows[gap_a.id]["status"]).to eq("confirmed")
        expect(rows[gap_b.id]["status"]).to eq("confirmed")
        # ONE node for the group, deduped against the plan's existing titles.
        created = KnowledgeNode.where(plan_id: plan.id, title: "Failure detection")
        expect(created.count).to eq(1)
        expect(rows[gap_a.id]["nodeId"]).to eq(created.sole.id)
        expect(rows[gap_b.id]["nodeId"]).to eq(created.sole.id)
        expect(rows[onto_existing.id]["status"]).to eq("confirmed")
        expect(rows[onto_existing.id]["nodeId"]).to eq(existing.id)
      end
    end

    it "answers VALIDATION_FAILED for an empty list and NOT_FOUND when any id is unknown" do
      user, token = user_with_token("mapping-confirm-bad@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "b" } ])
      gap = create(:material_node_mapping, user: user, material: material, section_id: "sec-1",
                                           proposed_node_title: "Proposal")

      empty_result = graphql(
        "mutation { confirmMappingProposals(input: { mappingIds: [] }) { mappings { id } } }",
        token: token
      )
      expect(error_code(empty_result)).to eq("VALIDATION_FAILED")

      unknown = graphql(
        "mutation { confirmMappingProposals(input: { mappingIds: [\"#{gap.id}\", \"#{SecureRandom.uuid}\"] }) " \
          "{ mappings { id } } }",
        token: token
      )
      expect(error_code(unknown)).to eq("NOT_FOUND")
      expect(gap.reload.status).to eq("proposed") # nothing changed
    end
  end

  describe "rejectMappingProposals" do
    it "flips the proposed rows to rejected over the wire, proposal kept as history" do
      user, token = user_with_token("mapping-reject@example.com")
      plan = create(:study_plan, user: user)
      material = create(:material, user: user, plan: plan, sections: [ { "id" => "sec-1", "title" => "S", "text" => "b" } ])
      gap = create(:material_node_mapping, user: user, material: material, section_id: "sec-1",
                                           proposed_node_title: "Failure detection")

      result = graphql(
        <<~GRAPHQL, variables: { input: { mappingIds: [ gap.id ] } }, token: token
          mutation RejectMappingProposals($input: RejectMappingProposalsInput!) {
            rejectMappingProposals(input: $input) {
              mappings { id status nodeId proposedNodeTitle }
            }
          }
        GRAPHQL
      )
      rows = result.dig("data", "rejectMappingProposals", "mappings")
      expect(rows.sole["status"]).to eq("rejected")
      expect(rows.sole["proposedNodeTitle"]).to eq("Failure detection")
      expect(rows.sole["nodeId"]).to be_nil
    end

    it "answers NOT_FOUND for a foreign id and leaves the row untouched" do
      _owner, token = user_with_token("mapping-reject-foreign@example.com")
      other = create(:user)
      foreign = create(:material_node_mapping, user: other,
                                               material: create(:material, user: other), section_id: "sec-1")

      result = graphql(
        "mutation { rejectMappingProposals(input: { mappingIds: [\"#{foreign.id}\"] }) { mappings { id } } }",
        token: token
      )

      expect(error_code(result)).to eq("NOT_FOUND")
      expect(foreign.reload.status).to eq("proposed")
    end
  end
end

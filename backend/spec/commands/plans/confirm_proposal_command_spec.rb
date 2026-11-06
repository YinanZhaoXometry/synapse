# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::ConfirmProposalCommand do
  # The creation-chat proposal-confirm seam (epic-05's stream produces the
  # proposal payload; this command confirms it into a plan + nodes). The
  # payload mirrors the Phase-1 PlanStructureProposal
  # (frontend/src/ai/types.ts): stage-grouped node titles, flattened here
  # exactly the way frontend/src/features/plans/creation-mapping.ts
  # (toPlanCreateInput) flattens it — stage-then-title, one global order
  # index.

  let(:user) { create(:user) }
  let(:client_uuid) { SecureRandom.uuid }
  let(:stages) do
    [
      { name: "基础", node_titles: [ "Graphql basics", "Commands" ] },
      { name: "核心", node_titles: [ "Scoping" ] }
    ]
  end

  def call(overrides = {})
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      topic: "Domain ops epic",
      goal: nil,
      visibility: nil,
      stages: stages,
      **overrides
    )
  end

  describe ".call" do
    it "confirms the proposal into a plan + one node per title, in stage-then-title order" do
      result = call

      expect(result.success?).to be(true)
      plan = result.value![:plan]
      nodes = result.value![:nodes]

      expect(plan.id).to eq(client_uuid)
      expect(plan.topic).to eq("Domain ops epic")

      expect(nodes.map(&:title)).to eq([ "Graphql basics", "Commands", "Scoping" ])
      expect(nodes.map(&:stage)).to eq([ "基础", "基础", "核心" ])
      expect(nodes.map(&:order)).to eq([ 0, 1, 2 ])
    end

    it "is idempotent on replay with the same client uuid (delta 3): Success, same rows" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(first.value![:plan].id)
      expect(replay.value![:nodes].map(&:id)).to match_array(first.value![:nodes].map(&:id))
      expect(user.knowledge_nodes.where(plan_id: client_uuid).count).to eq(3)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user" do
      call
      other = create(:user)

      result = described_class.call(
        current_user: other,
        client_uuid: client_uuid,
        topic: "other",
        stages: stages
      )

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED when there are no stages" do
      result = call(stages: [])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(StudyPlan.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when every stage is empty (nothing to persist)" do
      result = call(stages: [ { name: "基础", node_titles: [] } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(StudyPlan.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank stage name" do
      result = call(stages: [ { name: "  ", node_titles: [ "a node" ] } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(StudyPlan.count).to eq(0)
    end
  end

  describe "the epic-16 proposal shape (stage nodes + title-paired edges)" do
    let(:stages) do
      [
        { name: "基础", nodes: [ { title: "Graphql basics" }, { title: "Commands", description: " the spine ", optional: false } ] },
        { name: "核心", nodes: [ { title: "Scoping", optional: true } ] }
      ]
    end

    it "persists the per-node metadata and resolves the title pairs to stored edges" do
      result = call(edges: [ { from_title: "Graphql basics", to_title: "Scoping" } ])

      plan = result.value![:plan]
      nodes = plan.knowledge_nodes.order(:order).to_a
      edges = plan.knowledge_node_edges.order(:created_at, :id).to_a

      aggregate_failures do
        expect(nodes.map(&:description)).to eq([ nil, "the spine", nil ])
        expect(nodes.map(&:optional)).to eq([ false, false, true ])
        expect(edges.map { |edge| [edge.from_node_id, edge.to_node_id] })
          .to eq([ [nodes[0].id, nodes[2].id] ])
      end
    end

    it "drops an edge naming a duplicate title (unresolvable — deterministic) without blocking the confirm" do
      dup_stages = [
        { name: "基础", nodes: [ { title: "same" }, { title: "same" } ] },
        { name: "核心", nodes: [ { title: "later" } ] }
      ]

      result = call(stages: dup_stages, edges: [ { from_title: "same", to_title: "later" } ])

      plan = result.value![:plan]
      aggregate_failures do
        expect(result.success?).to be(true)
        expect(plan.knowledge_nodes.count).to eq(3)
        expect(plan.knowledge_node_edges).to be_empty
      end
    end

    it "drops an edge naming an unknown title (membership rule, silent)" do
      result = call(edges: [ { from_title: "Graphql basics", to_title: "no such node" } ])

      expect(result.value![:plan].knowledge_node_edges).to be_empty
    end

    it "drops a same-stage title pair via the stage-forward rule (silent)" do
      result = call(edges: [ { from_title: "Graphql basics", to_title: "Commands" } ])

      expect(result.value![:plan].knowledge_node_edges).to be_empty
    end
  end
end

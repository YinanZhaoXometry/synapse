# frozen_string_literal: true

require "rails_helper"

RSpec.describe KnowledgeNodeEdge, type: :model do
  let(:user) { User.create!(email: "knowledge-node-edge-spec@example.com", password_digest: "digest") }
  let(:plan) { StudyPlan.create!(user: user, topic: "edge spec plan") }
  let(:from_node) { KnowledgeNode.create!(user: user, plan: plan, title: "from", stage: "基础", order: 0) }
  let(:to_node) { KnowledgeNode.create!(user: user, plan: plan, title: "to", stage: "核心", order: 1) }

  let(:model_attributes) do
    { user: user, plan: plan, from_node: from_node, to_node: to_node }
  end

  it_behaves_like "a user-owned uuid model"

  it "keeps [from_node_id, to_node_id] unique — the dedupe floor under the command rule (epic-16)" do
    described_class.create!(model_attributes)

    expect do
      described_class.create!(model_attributes)
    end.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "reads the roadmap structure back through its associations" do
    edge = described_class.create!(model_attributes)

    aggregate_failures do
      expect(edge.from_node).to eq(from_node)
      expect(edge.to_node).to eq(to_node)
      expect(edge.plan.knowledge_node_edges).to include(edge)
      expect(user.knowledge_node_edges).to include(edge)
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

RSpec.describe KnowledgeNode, type: :model do
  let(:user) { User.create!(email: "knowledge-node-spec@example.com", password_digest: "digest") }

  let(:model_attributes) { { user: user, title: "Mastery Score basics", order: 0 } }

  it_behaves_like "a user-owned uuid model"

  it "keeps task_id unique — a task owns exactly one node (AD-6)" do
    index = ActiveRecord::Base.connection.indexes(:knowledge_nodes).find { |i| i.columns == %w[task_id] }

    expect(index).to be_present
    expect(index.unique).to be(true)
  end

  it "allows both directions of the task↔node pair (plan_id and task_id nullable)" do
    node = described_class.create!(model_attributes)

    expect(node.plan_id).to be_nil
    expect(node.task_id).to be_nil
  end
end

# frozen_string_literal: true

require "rails_helper"

RSpec.describe KnowledgeNode, type: :model do
  let(:user) { User.create!(email: "knowledge-node-spec@example.com", password_digest: "digest") }

  def node_attributes
    { user: user, title: "Mastery Score basics", order: 0 }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    node = described_class.create!(node_attributes)

    expect(node.id).to be_a_uuid
    expect(node.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    node = described_class.create!(node_attributes.merge(id: id))

    expect(node.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(node_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:knowledge_nodes)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "keeps task_id unique — a task owns exactly one node (AD-6)" do
    index = ActiveRecord::Base.connection.indexes(:knowledge_nodes).find { |i| i.columns == %w[task_id] }

    expect(index).to be_present
    expect(index.unique).to be(true)
  end

  it "allows both directions of the task↔node pair (plan_id and task_id nullable)" do
    node = described_class.create!(node_attributes)

    expect(node.plan_id).to be_nil
    expect(node.task_id).to be_nil
  end
end

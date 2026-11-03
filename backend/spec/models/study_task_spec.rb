# frozen_string_literal: true

require "rails_helper"

RSpec.describe StudyTask, type: :model do
  let(:user) { User.create!(email: "study-task-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Lecture 3", kind: "pdf", size_bytes: 2048) }
  let(:node) { KnowledgeNode.create!(user: user, title: "Single node", order: 0) }

  def task_attributes
    { user: user, material: material, node: node }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    task = described_class.create!(task_attributes)

    expect(task.id).to be_a_uuid
    expect(task.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    task = described_class.create!(task_attributes.merge(id: id))

    expect(task.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(task_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:study_tasks)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "owns exactly one material and one node (AD-6, both required)" do
    expect(described_class.new(task_attributes.except(:material))).not_to be_valid
    expect(described_class.new(task_attributes.except(:node))).not_to be_valid
  end
end

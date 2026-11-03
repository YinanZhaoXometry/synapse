# frozen_string_literal: true

require "rails_helper"

RSpec.describe StudyTask, type: :model do
  let(:user) { User.create!(email: "study-task-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Lecture 3", kind: "pdf", size_bytes: 2048) }
  let(:node) { KnowledgeNode.create!(user: user, title: "Single node", order: 0) }

  let(:model_attributes) { { user: user, material: material, node: node } }

  it_behaves_like "a user-owned uuid model"

  it "owns exactly one material and one node (AD-6, both required)" do
    expect(described_class.new(model_attributes.except(:material))).not_to be_valid
    expect(described_class.new(model_attributes.except(:node))).not_to be_valid
  end
end

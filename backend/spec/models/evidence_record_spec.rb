# frozen_string_literal: true

require "rails_helper"

RSpec.describe EvidenceRecord, type: :model do
  let(:user) { User.create!(email: "evidence-record-spec@example.com", password_digest: "digest") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Evidence node", order: 0) }

  let(:model_attributes) { { user: user, node: node, outcome: "correct" } }

  it_behaves_like "a user-owned uuid model"

  it "requires node attribution (AD-6) and allows a null session/question (forfeits)" do
    expect(described_class.new(model_attributes.except(:node))).not_to be_valid

    record = described_class.create!(model_attributes)

    expect(record.session_id).to be_nil
    expect(record.question_id).to be_nil
  end
end

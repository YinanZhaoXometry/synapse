# frozen_string_literal: true

require "rails_helper"

RSpec.describe EvidenceRecord, type: :model do
  let(:user) { User.create!(email: "evidence-record-spec@example.com", password_digest: "digest") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Evidence node", order: 0) }

  def evidence_attributes
    { user: user, node: node, outcome: "correct" }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    record = described_class.create!(evidence_attributes)

    expect(record.id).to be_a_uuid
    expect(record.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    record = described_class.create!(evidence_attributes.merge(id: id))

    expect(record.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(evidence_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:evidence_records)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "requires node attribution (AD-6) and allows a null session/question (forfeits)" do
    expect(described_class.new(evidence_attributes.except(:node))).not_to be_valid

    record = described_class.create!(evidence_attributes)

    expect(record.session_id).to be_nil
    expect(record.question_id).to be_nil
  end
end

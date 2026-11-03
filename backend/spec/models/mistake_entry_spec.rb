# frozen_string_literal: true

require "rails_helper"

RSpec.describe MistakeEntry, type: :model do
  let(:user) { User.create!(email: "mistake-entry-spec@example.com", password_digest: "digest") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Mistake node", order: 0) }
  let(:material) { Material.create!(user: user, title: "Mistake source", kind: "pdf", size_bytes: 8192) }
  let(:session) { QuizSession.create!(user: user, mode: "choice") }
  let(:question) do
    Question.create!(
      user: user, session: session, node: node, kind: "choice",
      prompt: "Pick the right one", options: %w[A B],
      source_material: material, source_section_id: "page-2",
      explanation: "B is right"
    )
  end

  def mistake_attributes
    {
      user: user, question: question, node: node,
      user_answer: "A", source_location: { kind: "pdf", page: 2 }
    }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    mistake = described_class.create!(mistake_attributes)

    expect(mistake.id).to be_a_uuid
    expect(mistake.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    mistake = described_class.create!(mistake_attributes.merge(id: id))

    expect(mistake.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(mistake_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:mistake_entries)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "defaults forfeited to false and keeps the ReadingLocator jsonb verbatim (AD-2)" do
    mistake = described_class.create!(mistake_attributes)

    expect(mistake.forfeited).to be(false)
    expect(mistake.reload.source_location).to eq("kind" => "pdf", "page" => 2)
  end
end

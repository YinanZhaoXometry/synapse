# frozen_string_literal: true

require "rails_helper"

RSpec.describe Question, type: :model do
  let(:user) { User.create!(email: "question-spec@example.com", password_digest: "digest") }
  let(:session) { QuizSession.create!(user: user, mode: "open") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Attribution node", order: 0) }
  let(:source_material) { Material.create!(user: user, title: "Source text", kind: "markdown", size_bytes: 512) }

  def question_attributes
    {
      user: user, session: session, node: node, kind: "open",
      prompt: "Why is the Mastery Score evidence-only?",
      source_material: source_material, source_section_id: "page-1",
      explanation: "Marking is a claim; only graded evidence moves the score."
    }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    question = described_class.create!(question_attributes)

    expect(question.id).to be_a_uuid
    expect(question.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    question = described_class.create!(question_attributes.merge(id: id))

    expect(question.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(question_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:questions)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "keeps materials-sourced provenance (FR-18/NFR-1: section ids are slugs, not uuids)" do
    question = described_class.create!(question_attributes)

    expect(question.source_material_id).to eq(source_material.id)
    expect(question.source_section_id).to eq("page-1")
  end

  it "stores choice options and grading keywords as jsonb" do
    question = described_class.create!(
      question_attributes.merge(
        kind: "choice",
        options: [ "A", "B", "C", "D" ],
        correct_option_index: 2,
        keywords: [ "evidence", "quiz" ]
      )
    )

    expect(question.reload.options).to eq([ "A", "B", "C", "D" ])
    expect(question.correct_option_index).to eq(2)
    expect(question.reload.keywords).to eq([ "evidence", "quiz" ])
  end
end

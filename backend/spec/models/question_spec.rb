# frozen_string_literal: true

require "rails_helper"

RSpec.describe Question, type: :model do
  let(:user) { User.create!(email: "question-spec@example.com", password_digest: "digest") }
  let(:session) { QuizSession.create!(user: user, mode: "open") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Attribution node", order: 0) }
  let(:source_material) { Material.create!(user: user, title: "Source text", kind: "markdown", size_bytes: 512) }

  let(:model_attributes) do
    {
      user: user, session: session, node: node, kind: "open",
      prompt: "Why is the Mastery Score evidence-only?",
      source_material: source_material, source_section_id: "page-1",
      explanation: "Marking is a claim; only graded evidence moves the score."
    }
  end

  it_behaves_like "a user-owned uuid model"

  it "keeps materials-sourced provenance (FR-18/NFR-1: section ids are slugs, not uuids)" do
    question = described_class.create!(model_attributes)

    expect(question.source_material_id).to eq(source_material.id)
    expect(question.source_section_id).to eq("page-1")
  end

  it "stores choice options and grading keywords as jsonb" do
    question = described_class.create!(
      model_attributes.merge(
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

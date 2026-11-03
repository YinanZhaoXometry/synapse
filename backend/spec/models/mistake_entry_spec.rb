# frozen_string_literal: true

require "rails_helper"

RSpec.describe MistakeEntry, type: :model do
  let(:user) { User.create!(email: "mistake-entry-spec@example.com", password_digest: "digest") }
  let(:node) { KnowledgeNode.create!(user: user, title: "Mistake node", order: 0) }
  let(:material) { Material.create!(user: user, title: "Mistake source", kind: "pdf", size_bytes: 8192) }
  # Exactly one of plan_id/task_id is DB-enforced (quiz_sessions
  # exactly_one_owner_check) — attach a plan for the raw create here.
  let(:session) do
    QuizSession.create!(user: user, plan: StudyPlan.create!(user: user, topic: "Mistake plan"), mode: "choice")
  end
  let(:question) do
    Question.create!(
      user: user, session: session, node: node, kind: "choice",
      prompt: "Pick the right one", options: %w[A B],
      source_material: material, source_section_id: "page-2",
      explanation: "B is right",
      # NOT NULL on the ER — the generation order (P2-3 of the epic P2-3
      # review); the command stamps real per-input indices.
      position: 0
    )
  end

  let(:model_attributes) do
    {
      user: user, question: question, node: node,
      user_answer: "A", source_location: { kind: "pdf", page: 2 }
    }
  end

  it_behaves_like "a user-owned uuid model"

  it "defaults forfeited to false and keeps the ReadingLocator jsonb verbatim (AD-2)" do
    mistake = described_class.create!(model_attributes)

    expect(mistake.forfeited).to be(false)
    expect(mistake.reload.source_location).to eq("kind" => "pdf", "page" => 2)
  end
end

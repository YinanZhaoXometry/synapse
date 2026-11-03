# frozen_string_literal: true

require "rails_helper"

RSpec.describe Flashcard, type: :model do
  let(:user) { User.create!(email: "flashcard-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Flashcard deck source", kind: "pdf", size_bytes: 4096) }

  let(:model_attributes) { { user: user, material: material, front: "What is AD-6?", back: "Node attribution rule" } }

  it_behaves_like "a user-owned uuid model"

  it "defaults difficulty to nil — self-rating only, never evidence (GLOSSARY)" do
    flashcard = described_class.create!(model_attributes)

    expect(flashcard.difficulty).to be_nil

    flashcard.update!(difficulty: "hard")
    expect(flashcard.reload.difficulty).to eq("hard")
  end
end

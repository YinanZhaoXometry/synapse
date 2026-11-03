# frozen_string_literal: true

require "rails_helper"

RSpec.describe Flashcard, type: :model do
  let(:user) { User.create!(email: "flashcard-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Flashcard deck source", kind: "pdf", size_bytes: 4096) }

  def flashcard_attributes
    { user: user, material: material, front: "What is AD-6?", back: "Node attribution rule" }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    flashcard = described_class.create!(flashcard_attributes)

    expect(flashcard.id).to be_a_uuid
    expect(flashcard.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    flashcard = described_class.create!(flashcard_attributes.merge(id: id))

    expect(flashcard.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(flashcard_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:flashcards)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "defaults difficulty to nil — self-rating only, never evidence (GLOSSARY)" do
    flashcard = described_class.create!(flashcard_attributes)

    expect(flashcard.difficulty).to be_nil

    flashcard.update!(difficulty: "hard")
    expect(flashcard.reload.difficulty).to eq("hard")
  end
end

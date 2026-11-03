# frozen_string_literal: true

require "rails_helper"

RSpec.describe QuizSession, type: :model do
  let(:user) { User.create!(email: "quiz-session-spec@example.com", password_digest: "digest") }

  def session_attributes
    { user: user, mode: "open" }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    session = described_class.create!(session_attributes)

    expect(session.id).to be_a_uuid
    expect(session.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    session = described_class.create!(session_attributes.merge(id: id))

    expect(session.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(session_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:quiz_sessions)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "starts active with no completion timestamp" do
    expect(described_class.new.status).to eq("active")
    expect(described_class.new.completed_at).to be_nil

    session = described_class.create!(session_attributes)

    expect(session.status).to eq("active")
  end
end

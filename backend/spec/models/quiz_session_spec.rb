# frozen_string_literal: true

require "rails_helper"

RSpec.describe QuizSession, type: :model do
  let(:user) { User.create!(email: "quiz-session-spec@example.com", password_digest: "digest") }

  let(:model_attributes) { { user: user, mode: "open" } }

  it_behaves_like "a user-owned uuid model"

  it "starts active with no completion timestamp" do
    expect(described_class.new.status).to eq("active")
    expect(described_class.new.completed_at).to be_nil

    session = described_class.create!(model_attributes)

    expect(session.status).to eq("active")
  end
end

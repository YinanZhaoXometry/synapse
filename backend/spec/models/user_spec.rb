# frozen_string_literal: true

require "rails_helper"

RSpec.describe User, type: :model do
  # The scoping root: no belongs_to :user of its own — it carries only the
  # uuid pair from the shared structural examples.
  it_behaves_like "a uuid primary-key model"

  let(:model_attributes) { { email: "user-spec@example.com", password_digest: "digest" } }

  it "requires an email and keeps it unique" do
    expect(described_class.new(password_digest: "digest")).not_to be_valid

    described_class.create!(email: "user-spec-c@example.com", password_digest: "digest")

    duplicate = described_class.new(email: "user-spec-c@example.com", password_digest: "digest")
    expect(duplicate).not_to be_valid
  end

  describe "has_secure_password (AD-15)" do
    it "digests an assigned password and authenticates against it" do
      user = described_class.create!(email: "pw-spec@example.com", password: "password123")

      expect(user.password_digest).to be_present
      expect(user.authenticate("password123")).to eq(user)
      expect(user.authenticate("password124")).to be(false)
    end
  end
end

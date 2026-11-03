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

    # Verified empirically in the test container (epic P2-2 review, finding
    # P1-B): Rails' activemodel railtie initializer sets
    # `ActiveModel::SecurePassword.min_cost = Rails.env.test?`, so digests
    # here run at BCrypt::Engine::MIN_COST (4), NOT BCrypt::Engine.cost (12)
    # — the factory comment's "MIN_COST — free" claim is true by framework
    # mechanism, not by app config (the app sets no bcrypt cost anywhere).
    # Pinned so a future env/config change that silently re-costs the suite
    # to 12 fails here by name.
    it "digests at BCrypt::Engine::MIN_COST in the test env (railtie sets SecurePassword.min_cost = Rails.env.test?)" do
      expect(ActiveModel::SecurePassword.min_cost).to be(true)
      expect(BCrypt::Engine::MIN_COST).to eq(4)

      user = described_class.new(password: "cost-probe-password")

      expect(BCrypt::Password.new(user.password_digest).cost).to eq(BCrypt::Engine::MIN_COST)
    end
  end
end

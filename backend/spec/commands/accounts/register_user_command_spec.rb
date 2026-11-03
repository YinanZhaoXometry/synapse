# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounts::RegisterUserCommand do
  # Token minting reads JWT_SECRET from ENV (AD-12 config posture) — pin a
  # known secret for each example and restore whatever was there before.
  around do |example|
    original = ENV["JWT_SECRET"]
    ENV["JWT_SECRET"] = "test-signing-secret"
    example.run
  ensure
    if original.nil?
      ENV.delete("JWT_SECRET")
    else
      ENV["JWT_SECRET"] = original
    end
  end

  describe ".call happy path" do
    it "creates the user and returns Success(user, token) whose token decodes to the user's uuid" do
      result = described_class.call(email: "register-spec@example.com", password: "password123")

      expect(result.success?).to be(true)
      payload = result.value!
      user = payload[:user]
      expect(user).to be_persisted
      expect(user.email).to eq("register-spec@example.com")

      decoded = Accounts::TokenCodec.decode(payload[:token])
      expect(decoded).to be_ok
      expect(decoded.user_uuid).to eq(user.id)
    end
  end

  describe ".call credential rules (command-side by design — the model stays minimal)" do
    it "downcases the email before create" do
      result = described_class.call(email: "MixedCase@Synapse.TEST", password: "password123")

      expect(result.success?).to be(true)
      expect(result.value![:user].email).to eq("mixedcase@synapse.test")
    end

    it "rejects an email that is not an email shape with VALIDATION_FAILED" do
      %w[not-an-email @example.com user@].each do |shapeless|
        result = described_class.call(email: shapeless, password: "password123")

        expect(result.failure?).to be(true), "expected #{shapeless.inspect} to be rejected"
        failure = result.failure
        expect(failure.code).to eq(:VALIDATION_FAILED)
        expect(failure.context[:field]).to eq(:email)
      end

      expect(User.exists?(email: "not-an-email")).to be(false)
    end

    it "rejects a password shorter than 8 characters with VALIDATION_FAILED (8 is the boundary)" do
      result = described_class.call(email: "short-pass@example.com", password: "1234567")

      expect(result.failure?).to be(true)
      failure = result.failure
      expect(failure.code).to eq(:VALIDATION_FAILED)
      expect(failure.context[:field]).to eq(:password)
      expect(User.exists?(email: "short-pass@example.com")).to be(false)

      boundary = described_class.call(email: "short-pass@example.com", password: "12345678")
      expect(boundary.success?).to be(true)
    end

    it "rejects nil and blank inputs with VALIDATION_FAILED (never raises)" do
      nil_email = described_class.call(email: nil, password: "password123")
      expect(nil_email.failure?).to be(true)
      expect(nil_email.failure.code).to eq(:VALIDATION_FAILED)

      nil_password = described_class.call(email: "nil-pass@example.com", password: nil)
      expect(nil_password.failure?).to be(true)
      expect(nil_password.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "rejects a duplicate email with VALIDATION_FAILED, matching case-insensitively" do
      described_class.call(email: "duplicate@example.com", password: "password123")

      result = described_class.call(email: "DUPLICATE@EXAMPLE.COM", password: "another-pass-123")

      expect(result.failure?).to be(true)
      failure = result.failure
      expect(failure.code).to eq(:VALIDATION_FAILED)
      expect(failure.context[:field]).to eq(:email)
      expect(User.where(email: "duplicate@example.com").count).to eq(1)
    end

    it "keeps every failure's log context present (ErrorPresenter feeds on context[:message])" do
      result = described_class.call(email: "not-an-email", password: "password123")

      expect(result.failure.context[:message]).to be_a(String)
    end

    it "maps a RecordNotUnique race past the pre-check to VALIDATION_FAILED (backstop)" do
      create(:user, email: "race@example.com")

      # Simulate the race window: the pre-check and the model-level uniqueness
      # validation both miss the row, the INSERT itself hits the unique index.
      allow(User).to receive(:exists?).and_return(false)
      allow_any_instance_of(User).to receive(:valid?).and_return(true)

      result = described_class.call(email: "race@example.com", password: "password123")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:email)
      expect(User.where(email: "race@example.com").count).to eq(1)
    end
  end
end

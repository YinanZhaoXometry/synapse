# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounts::LoginUserCommand do
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
    it "authenticates the user and returns Success(user, token) whose token decodes to the user's uuid" do
      user = create(:user, email: "login-spec@example.com", password: "known-password-123")

      result = described_class.call(email: "login-spec@example.com", password: "known-password-123")

      expect(result.success?).to be(true)
      payload = result.value!
      expect(payload[:user].id).to eq(user.id)

      decoded = Accounts::TokenCodec.decode(payload[:token])
      expect(decoded).to be_ok
      expect(decoded.user_uuid).to eq(user.id)
    end

    it "looks the user up by downcased email" do
      create(:user, email: "downcase@example.com", password: "known-password-123")

      result = described_class.call(email: "DOWNCASE@EXAMPLE.COM", password: "known-password-123")

      expect(result.success?).to be(true)
      expect(result.value![:user].email).to eq("downcase@example.com")
    end
  end

  describe ".call wrong credentials — UNAUTHORIZED, never revealing which half" do
    it "fails UNAUTHORIZED for a wrong password" do
      create(:user, email: "wrong-pass@example.com", password: "known-password-123")

      result = described_class.call(email: "wrong-pass@example.com", password: "not-the-password")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:UNAUTHORIZED)
    end

    it "fails UNAUTHORIZED for an unknown email" do
      result = described_class.call(email: "nobody@example.com", password: "known-password-123")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:UNAUTHORIZED)
    end

    it "is indistinguishable between the two halves (same code, same failure shape)" do
      create(:user, email: "shape@example.com", password: "known-password-123")

      wrong_password = described_class.call(email: "shape@example.com", password: "not-the-password")
      unknown_email = described_class.call(email: "nobody@example.com", password: "known-password-123")

      expect(wrong_password.failure.code).to eq(:UNAUTHORIZED)
      expect(unknown_email.failure.code).to eq(:UNAUTHORIZED)
      # ApplicationErrors::Failure is a Struct — equality means the context
      # (message, no per-half detail) is byte-identical too.
      expect(unknown_email.failure).to eq(wrong_password.failure)
    end

    it "fails UNAUTHORIZED (not a raise) for nil or blank inputs" do
      nil_email = described_class.call(email: nil, password: "known-password-123")
      nil_password = described_class.call(email: "shape@example.com", password: nil)

      expect(nil_email.failure?).to be(true)
      expect(nil_email.failure.code).to eq(:UNAUTHORIZED)
      expect(nil_password.failure?).to be(true)
      expect(nil_password.failure.code).to eq(:UNAUTHORIZED)
    end
  end

  describe ".call rate limiting (epic P2-2 ticket 02)" do
    it "fails RATE_LIMITED before credential verification once the window is tripped" do
      email = "rate-limited@example.com"
      create(:user, email: email, password: "known-password-123")

      # Trip the window for this email through the limiter's own decision
      # API — the command's pre-check must then deny without even looking at
      # the credentials (the correct password below proves the ordering).
      Accounts::LoginRateLimiter::DEFAULT_THRESHOLD.times do
        expect(Accounts::LoginRateLimiter.attempt(email)).to be(true)
      end

      result = described_class.call(email: email, password: "known-password-123")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:RATE_LIMITED)
    end

    it "still authenticates normally while the window is under the threshold" do
      create(:user, email: "under-limit@example.com", password: "known-password-123")

      result = described_class.call(email: "under-limit@example.com", password: "known-password-123")

      expect(result.success?).to be(true)
    end
  end
end

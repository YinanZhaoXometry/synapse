# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounts::ChangePasswordCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam (epic-14 T1, FR-30). Rules: verify the CURRENT password
  # against the stored bcrypt digest (a wrong current is an honest field
  # error — VALIDATION_FAILED on currentPassword, never an auth failure),
  # enforce the register rule's minimum on the new password, rate-limit the
  # attempts through the login limiter's mechanism, and leave the session
  # alone — the stateless JWT (sub: user uuid) survives by construction
  # (AD-15: no revocation list exists or is built).

  let(:user) { create(:user, email: "changer@example.com", password: "known-password-123") }

  def call(overrides = {})
    described_class.call(**{
      current_user: user,
      current_password: "known-password-123",
      new_password: "a-fresh-password-456"
    }.merge(overrides))
  end

  describe ".call happy path" do
    it "re-digests the password: the new password authenticates, the old one stops" do
      result = call

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:user].id).to eq(user.id)
        expect(user.reload.authenticate("a-fresh-password-456")).to be_truthy
        expect(user.authenticate("known-password-123")).to be_falsey
      end
    end

    it "leaves the session credential valid: a JWT minted before the change still decodes to the user (stateless — no revocation)" do
      token = Accounts::TokenCodec.encode(sub: user.id)

      expect(call.success?).to be(true)

      decoded = Accounts::TokenCodec.decode(token)
      aggregate_failures do
        expect(decoded).to be_ok
        expect(decoded.user_uuid).to eq(user.id)
      end
    end
  end

  describe ".call wrong current password — an honest field error, NOT an auth failure" do
    it "fails VALIDATION_FAILED on the currentPassword field" do
      result = call(current_password: "not-the-password")

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:currentPassword)
      end
    end

    it "keeps the stored digest: the old password still authenticates, nothing was written" do
      call(current_password: "not-the-password")

      aggregate_failures do
        expect(user.reload.authenticate("known-password-123")).to be_truthy
        expect(user.authenticate("a-fresh-password-456")).to be_falsey
      end
    end
  end

  describe ".call weak new password — the register rule's minimum" do
    it "fails VALIDATION_FAILED for a password under Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH" do
      result = call(new_password: "short")

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:message]).to match(/at least #{Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH}/)
      end
    end

    it "admits a password of exactly the minimum length" do
      result = call(new_password: "a" * Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH)

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(user.reload.authenticate("a" * Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH)).to be_truthy
      end
    end

    it "keeps the stored digest when the new password is refused" do
      call(new_password: "short")

      expect(user.reload.authenticate("known-password-123")).to be_truthy
    end
  end

  describe ".call rate limiting — the login limiter's mechanism, mirrored" do
    it "fails RATE_LIMITED before any credential verification once the email's window is tripped" do
      # Trip the window for this email through the limiter's own decision
      # API — the command's pre-check must then deny without even looking at
      # the credentials (the WRONG current password below still answers
      # RATE_LIMITED, not VALIDATION_FAILED — the limiter runs first).
      Accounts::LoginRateLimiter::DEFAULT_THRESHOLD.times do
        expect(Accounts::LoginRateLimiter.attempt(user.email)).to be(true)
      end

      result = call(current_password: "not-the-password")

      expect(result.failure.code).to eq(:RATE_LIMITED)
    end

    it "succeeds normally while the window is under the threshold" do
      expect(call.success?).to be(true)
    end
  end
end

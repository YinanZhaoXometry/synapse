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
end

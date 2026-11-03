# frozen_string_literal: true

require "rails_helper"

RSpec.describe CurrentUserResolver do
  # Tokens are minted/verified with JWT_SECRET from ENV (AD-12 posture) —
  # pin a known secret for each example and restore whatever was there.
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

  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, email: "resolver@example.com", password: "known-password-123") }
  let(:token) { Accounts::TokenCodec.encode(sub: user.id, now: mint_time) }
  let(:mint_time) { Time.utc(2026, 11, 4, 12, 0, 0) }
  let(:resolver) { described_class.new(authorization) }

  describe "#user — the memoized resolution" do
    context "with a well-formed Bearer token" do
      let(:authorization) { "Bearer #{token}" }

      it "resolves the user the token was minted for" do
        expect(resolver.user).to eq(user)
        expect(resolver.decode_error).to be_nil
      end

      it "memoizes: the same instance on every call (one decode + one lookup per request)" do
        first = resolver.user

        expect(resolver.user).to equal(first)
      end
    end

    it "accepts the scheme case-insensitively" do
      expect(described_class.new("bearer #{token}").user).to eq(user)
    end

    it "resolves nothing for a nil header (public request)" do
      expect(described_class.new(nil).user).to be_nil
      expect(described_class.new(nil).decode_error).to eq(:invalid)
    end

    it "resolves nothing for a header without the Bearer scheme" do
      expect(described_class.new(token).user).to be_nil
      expect(described_class.new(token).decode_error).to eq(:invalid)
    end

    it "resolves nothing for a garbage token" do
      expect(described_class.new("Bearer not-a-token").user).to be_nil
      expect(described_class.new("Bearer not-a-token").decode_error).to eq(:invalid)
    end

    it "resolves nothing for an expired token, with the :expired distinction for logs" do
      travel_to(mint_time + Accounts::TokenCodec::TTL) do
        expect(described_class.new("Bearer #{token}").user).to be_nil
        expect(described_class.new("Bearer #{token}").decode_error).to eq(:expired)
      end
    end

    it "resolves nothing for a valid token whose user no longer exists (no denylist, stateless)" do
      user.destroy!

      expect(described_class.new("Bearer #{token}").user).to be_nil
      expect(described_class.new("Bearer #{token}").decode_error).to be_nil
    end

    it "never raises — resolution is a value, the guard decides (AD-12)" do
      expect { described_class.new("Bearer 🗑️ garbage").user }.not_to raise_error
      expect { described_class.new(12345).user }.not_to raise_error
    end
  end
end

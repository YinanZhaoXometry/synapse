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
  # Clock-relative, NOT a hard-coded instant: a fixed mint time is a
  # time-bomb — these specs started failing when 2026-11-04T12:00Z + the
  # 24h TTL lapsed (defused 2026-11-05, epic-13 T3; no behavior change).
  let(:mint_time) { Time.current - 1.hour }
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

    # P2-4: an anonymous request (no extractable token) must not pay a decode
    # and must not log — the pre-review resolver logged "[auth] bearer token
    # invalid" at info for EVERY such request.
    it "resolves nothing for a nil header (public request) — no decode, no log, no decode_error" do
      allow(Accounts::TokenCodec).to receive(:decode)
      allow(Rails.logger).to receive(:info)

      anonymous = described_class.new(nil)
      expect(anonymous.user).to be_nil
      expect(anonymous.decode_error).to be_nil

      expect(Accounts::TokenCodec).not_to have_received(:decode)
      expect(Rails.logger).not_to have_received(:info)
    end

    it "resolves nothing for a header without the Bearer scheme — still anonymous (no decode, no log)" do
      allow(Accounts::TokenCodec).to receive(:decode)
      allow(Rails.logger).to receive(:info)

      schemeless = described_class.new(token)
      expect(schemeless.user).to be_nil
      expect(schemeless.decode_error).to be_nil

      expect(Accounts::TokenCodec).not_to have_received(:decode)
      expect(Rails.logger).not_to have_received(:info)
    end

    it "resolves nothing for a garbage token — PRESENT but bad keeps the :invalid info line" do
      allow(Accounts::TokenCodec).to receive(:decode).and_call_original
      allow(Rails.logger).to receive(:info)

      garbage = described_class.new("Bearer not-a-token")
      expect(garbage.user).to be_nil
      expect(garbage.decode_error).to eq(:invalid)

      expect(Accounts::TokenCodec).to have_received(:decode).once
      expect(Rails.logger).to have_received(:info).with(/bearer token invalid/)
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

# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounts::TokenCodec do
  # The codec reads JWT_SECRET from ENV (AD-12 config posture) — pin a known
  # secret for each example and restore whatever was there before.
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

  describe ".encode + .decode round-trip" do
    it "round-trips the user uuid through an HMAC-signed token" do
      uuid = "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b"

      token = described_class.encode(sub: uuid)
      result = described_class.decode(token)

      expect(result).to be_ok
      expect(result.user_uuid).to eq(uuid)
      expect(result.error).to be_nil
    end

    it "mints a stateless token whose exp claim is sub's mint time + the ~24h TTL" do
      uuid = "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b"
      mint_time = Time.utc(2026, 11, 4, 12, 0, 0)

      token = described_class.encode(sub: uuid, now: mint_time)

      # Independent source of truth: decode with the jwt gem directly instead
      # of trusting the codec's own decoder.
      payload, _header = JWT.decode(token, "test-signing-secret", true, algorithm: "HS256")
      expect(payload["sub"]).to eq(uuid)
      expect(payload["exp"]).to eq((mint_time + 24.hours).to_i)
    end

    it "fails fast at encode when JWT_SECRET is absent (infrastructure misconfiguration)" do
      ENV.delete("JWT_SECRET")

      expect { described_class.encode(sub: "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b") }
        .to raise_error(Accounts::TokenCodec::MissingSecretError, /JWT_SECRET/)
    end
  end
end

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
      # Clock-relative, NOT a hard-coded instant: a fixed mint time is a
      # time-bomb — the raw JWT.decode below verifies exp against the REAL
      # clock, so the fixed 2026-11-04T12:00Z started expiring exactly 24h
      # later (defused 2026-11-05, epic-13 T3; the exp arithmetic asserted
      # below is unchanged).
      mint_time = 23.hours.ago

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

  describe ".decode expiry boundary (deterministic clock, no sleeps)" do
    include ActiveSupport::Testing::TimeHelpers

    it "accepts a token one second before its expiry" do
      mint_time = Time.utc(2026, 11, 4, 12, 0, 0)
      token = described_class.encode(sub: "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b", now: mint_time)

      travel_to(mint_time + described_class::TTL - 1.second) do
        result = described_class.decode(token)

        expect(result).to be_ok
        expect(result.user_uuid).to eq("2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b")
      end
    end

    it "rejects the same token at its exact expiry second with :expired" do
      mint_time = Time.utc(2026, 11, 4, 12, 0, 0)
      token = described_class.encode(sub: "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b", now: mint_time)

      travel_to(mint_time + described_class::TTL) do
        result = described_class.decode(token)

        expect(result).not_to be_ok
        expect(result.error).to eq(:expired)
        expect(result.user_uuid).to be_nil
      end
    end
  end

  describe ".decode failure taxonomy (never raises)" do
    # Every failure path below must come back as a typed Decoded result —
    # ticket 02's auth boundary maps both :expired and :invalid to
    # UNAUTHORIZED, so neither may escape as an exception or collapse into
    # the other.
    it "returns :invalid for a malformed token" do
      result = described_class.decode("not-a-token")

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
      expect(result.user_uuid).to be_nil
    end

    it "returns :invalid for an empty or nil token" do
      [ "", nil ].each do |garbage|
        result = described_class.decode(garbage)

        expect(result).not_to be_ok
        expect(result.error).to eq(:invalid)
      end
    end

    it "returns :invalid for a token signed with a different secret" do
      token = described_class.encode(sub: "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b")

      ENV["JWT_SECRET"] = "a-different-secret"
      result = described_class.decode(token)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
    end

    it "returns :invalid for a well-signed token missing a required claim" do
      # Minted with the raw jwt gem — an independent source of a sub-only
      # token (no exp), i.e. not something the codec would produce.
      sub_only = JWT.encode({ "sub" => "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b" },
                            "test-signing-secret", "HS256")

      result = described_class.decode(sub_only)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
    end

    # P2-5: `sub` feeds a uuid-PK lookup downstream — a well-signed token
    # whose sub is not uuid-shaped must stop at the codec as :invalid, not
    # sail through and surface as PG::InvalidTextRepresentation (a 500) at
    # the first User lookup.
    it "returns :invalid for a well-signed token whose sub is not uuid-shaped" do
      wrong_shape = JWT.encode(
        { "sub" => "../../etc/passwd", "exp" => 1.hour.from_now.to_i },
        "test-signing-secret", "HS256"
      )

      result = described_class.decode(wrong_shape)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
      expect(result.user_uuid).to be_nil
    end

    it "returns :invalid for a well-signed token whose sub is a non-string scalar" do
      integer_sub = JWT.encode({ "sub" => 12_345, "exp" => 1.hour.from_now.to_i },
                               "test-signing-secret", "HS256")

      result = described_class.decode(integer_sub)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
    end

    # P2-5, alg confusion: decode pins the algorithm to HS256 (ALGORITHM) —
    # a token minted with ANY other algorithm must never verify, even when
    # signed with the correct secret.
    it "returns :invalid for an alg-none token (never accepted, signed or not)" do
      unsigned = JWT.encode(
        { "sub" => "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b", "exp" => 1.hour.from_now.to_i },
        "", "none"
      )

      result = described_class.decode(unsigned)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
      expect(result.user_uuid).to be_nil
    end

    it "returns :invalid for an HS512-signed token with the correct secret (algorithm pinned to HS256)" do
      hs512 = JWT.encode(
        { "sub" => "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b", "exp" => 1.hour.from_now.to_i },
        "test-signing-secret", "HS512"
      )

      result = described_class.decode(hs512)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
      expect(result.user_uuid).to be_nil
    end

    it "returns :invalid when JWT_SECRET is absent at decode time" do
      token = described_class.encode(sub: "2f0c6a1e-8b3d-4e5f-9a0b-1c2d3e4f5a6b")

      ENV.delete("JWT_SECRET")
      result = described_class.decode(token)

      expect(result).not_to be_ok
      expect(result.error).to eq(:invalid)
    end
  end
end

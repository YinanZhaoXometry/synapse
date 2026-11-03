# frozen_string_literal: true

module Accounts
  # The stateless JWT primitive (AD-15): mints and verifies the session tokens
  # the Accounts commands (P2-2 ticket 01) and the GraphQL auth boundary
  # (ticket 02) share. HMAC-SHA256 over claims `sub` (user uuid) + `exp`
  # (~24h TTL), signed with ENV["JWT_SECRET"] — AD-12 config posture, no
  # settings gem.
  #
  # Lives under app/lib/, not app/commands/: it is not a use case, so it must
  # not pose as an ApplicationCommand (AD-12 command-layer-first); it is the
  # Accounts context's shared crypto primitive, autoloaded under the same
  # namespace as its commands.
  #
  # Failure contract:
  # - encode fails fast on an absent/blank secret — you cannot mint a token
  #   without a key, and a missing JWT_SECRET is an infrastructure fault, not
  #   a domain outcome (inside a command it surfaces as the typed INTERNAL
  #   failure ApplicationCommand already provides).
  # - decode NEVER raises — every failure mode (malformed token, bad
  #   signature, wrong algorithm, missing claims, expired signature, absent
  #   secret) comes back as a typed Decoded result. The expired-vs-invalid
  #   distinction survives so ticket 02's boundary can map both to
  #   UNAUTHORIZED while still telling them apart in logs.
  class TokenCodec
    ALGORITHM = "HS256"
    # AD-15: stateless tokens, no refresh/denylist — accepted risk.
    TTL = 24.hours

    # Raised only by encode when JWT_SECRET is absent/blank: infrastructure
    # misconfiguration fails fast at the seam instead of minting garbage.
    MissingSecretError = Class.new(StandardError)

    # Typed decode outcome: `user_uuid` is set only when the token verified;
    # `error` is :expired or :invalid otherwise. `ok?` reads naturally at the
    # call site (`result.ok? or map result.error to UNAUTHORIZED`).
    Decoded = Struct.new(:user_uuid, :error, keyword_init: true) do
      def ok?
        error.nil?
      end
    end

    class << self
      # Mint a token for the user uuid. `now` is injectable so specs pin the
      # expiry deterministically (no sleeps).
      def encode(sub:, now: Time.current)
        JWT.encode({ "sub" => sub, "exp" => (now + TTL).to_i }, secret!, ALGORITHM)
      end

      # Verify a token and return its user uuid — never raises.
      def decode(token)
        return Decoded.new(user_uuid: nil, error: :invalid) if secret.blank?

        payload, = JWT.decode(
          token.to_s,
          secret,
          true,
          { algorithm: ALGORITHM, required_claims: %w[sub exp] }
        )
        Decoded.new(user_uuid: payload["sub"], error: nil)
      rescue JWT::ExpiredSignature
        Decoded.new(user_uuid: nil, error: :expired)
      rescue JWT::DecodeError
        Decoded.new(user_uuid: nil, error: :invalid)
      end

      private

      def secret
        ENV["JWT_SECRET"]
      end

      def secret!
        config = secret
        return config if config.present?

        raise MissingSecretError,
              "JWT_SECRET is not set — token minting needs a signing secret " \
              "(see backend/.env.example)"
      end
    end
  end
end

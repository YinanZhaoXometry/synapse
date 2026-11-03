# frozen_string_literal: true

module Accounts
  # Log a user in with email + password (AD-15). Returns Success(user, token)
  # — the minted JWT (Accounts::TokenCodec) is the session credential.
  #
  # Wrong credentials → UNAUTHORIZED, never revealing which half was wrong:
  # User.authenticate_by returns nil for both an unknown email and a bad
  # password, and runs a dummy bcrypt verification on the miss path so the
  # timing of both is levelled (user enumeration stays off the table).
  #
  # Rate limiting (epic P2-2 ticket 02) sits here, not in the mutation, for
  # two reasons: it keeps the mutation thin (AD-12 — parse → command → map),
  # and the command is the single choke point for credential verification,
  # so every transport gets the same protection. The check runs BEFORE any
  # credential verification (never touches bcrypt when tripped) and counts
  # attempts per normalized email in a fixed window (Accounts::
  # LoginRateLimiter) — tripped ⇒ Failure(:RATE_LIMITED).
  class LoginUserCommand < ApplicationCommand
    option :email
    option :password

    def call
      unless Accounts::LoginRateLimiter.attempt(email)
        return Failure(:RATE_LIMITED, { message: "too many login attempts, try again later" })
      end

      user = User.authenticate_by(email: Accounts.normalize_email(email), password: password.to_s)
      return Failure(:UNAUTHORIZED, { message: "invalid email or password" }) unless user

      Success(user: user, token: Accounts::TokenCodec.encode(sub: user.id))
    end
  end
end

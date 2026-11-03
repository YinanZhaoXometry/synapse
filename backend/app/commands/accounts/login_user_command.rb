# frozen_string_literal: true

module Accounts
  # Log a user in with email + password (AD-15). Returns Success(user, token)
  # — the minted JWT (Accounts::TokenCodec) is the session credential.
  #
  # Wrong credentials → UNAUTHORIZED, never revealing which half was wrong:
  # User.authenticate_by returns nil for both an unknown email and a bad
  # password, and runs a dummy bcrypt verification on the miss path so the
  # timing of both is levelled (user enumeration stays off the table).
  # Rate limiting is NOT this command's concern — epic P2-2 ticket 02 lands
  # it at the mutation/command boundary.
  class LoginUserCommand < ApplicationCommand
    option :email
    option :password

    def call
      user = User.authenticate_by(email: email.to_s.downcase, password: password.to_s)
      return Failure(:UNAUTHORIZED, { message: "invalid email or password" }) unless user

      Success(user: user, token: Accounts::TokenCodec.encode(sub: user.id))
    end
  end
end

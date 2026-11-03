# frozen_string_literal: true

module Accounts
  # Register a user with email + password (AD-15). Returns Success(user,
  # token) — the minted JWT (Accounts::TokenCodec) is the session credential.
  # Credential validation (email shape, password minimum, duplicate email)
  # is command-side by design: the model keeps epic-01's minimal posture.
  class RegisterUserCommand < ApplicationCommand
    option :email
    option :password

    def call
      user = User.new(email: email.to_s.downcase, password: password.to_s)
      user.save!

      Success(user: user, token: Accounts::TokenCodec.encode(sub: user.id))
    end
  end
end

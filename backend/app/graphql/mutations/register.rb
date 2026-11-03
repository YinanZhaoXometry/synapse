# frozen_string_literal: true

module Mutations
  # Create an account with email + password and mint the session token
  # (AD-15). Thin boundary per AD-12: parse args → command → map the Result.
  # Every credential rule (email shape, password minimum, duplicate email)
  # lives in Accounts::RegisterUserCommand; failure mapping lives in
  # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
  class Register < BaseMutation
    description "Create an account with email + password (AD-15). Returns the session token and the new user."

    argument :email, String,
             required: true,
             description: "The account email. Downcased before create; must be unique."

    argument :password, String,
             required: true,
             description: "The account password (minimum 8 characters)."

    field :token, String,
          null: false,
          description: "The session JWT (Accounts::TokenCodec, ~24h TTL) — the bearer credential for subsequent operations."

    field :user, Types::UserType,
          null: false,
          description: "The newly created account."

    def resolve(email:, password:)
      command_result(Accounts::RegisterUserCommand.call(email: email, password: password))
    end
  end
end

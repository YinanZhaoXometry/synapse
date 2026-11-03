# frozen_string_literal: true

module Mutations
  # Exchange email + password for a session token (AD-15). Thin boundary per
  # AD-12: parse args → command → map the Result. Login attempts are
  # rate-limited inside Accounts::LoginUserCommand (Accounts::LoginRateLimiter,
  # epic P2-2 ticket 02): a tripped window is Failure(:RATE_LIMITED) before
  # any credential verification. There is deliberately no logout mutation —
  # logout is client-side token discard (epic-08).
  class Login < BaseMutation
    description "Log in with email + password (AD-15). Returns the session token and the user; attempts are rate-limited per email."

    argument :email, String,
             required: true,
             description: "The account email (downcased for the lookup)."

    argument :password, String,
             required: true,
             description: "The account password."

    field :token, String,
          null: false,
          description: "The session JWT (Accounts::TokenCodec, ~24h TTL) — the bearer credential for subsequent operations."

    field :user, Types::UserType,
          null: false,
          description: "The authenticated account."

    def resolve(email:, password:)
      command_result(Accounts::LoginUserCommand.call(email: email, password: password))
    end
  end
end

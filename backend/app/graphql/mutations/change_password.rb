# frozen_string_literal: true

module Mutations
  # Change the account password (AD-15, FR-30's account half — epic-14 T1).
  # Thin per AD-12: parse → authorize (current_user!) → command → map; the
  # verify-old rule, the register-minimum on the new password, the login
  # limiter's mirrored throttle, and the rate-limit ordering all live in
  # ::Accounts::ChangePasswordCommand; failure mapping lives in
  # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
  #
  # Sessions survive BY DESIGN: the JWT is stateless (sub = the user uuid,
  # unchanged by the mutation) and no revocation list exists or is built —
  # the schema description states that policy honestly (delta decision 2).
  # The login/register siblings' rule applies here too: the api never mints
  # a replacement token — the client's existing credential keeps working.
  class ChangePassword < BaseMutation
    description "Change the account password (AD-15, FR-30). The current password is verified (a wrong current is VALIDATION_FAILED on currentPassword — an honest field error, not an auth failure); the new password carries the register rule's minimum. Attempts are rate-limited per account (RATE_LIMITED on a burst). Sessions survive: the token is stateless (sub = user uuid) and stays valid — no revocation list exists."

    argument :current_password, String,
             required: true,
             description: "The account's current password — verified against the stored digest."

    argument :new_password, String,
             required: true,
             description: "The replacement password (at least 8 characters — the register rule), stored bcrypt-hashed."

    field :user, Types::UserType,
          null: false,
          description: "The account whose password changed."

    def resolve(current_password:, new_password:)
      command_result(Accounts::ChangePasswordCommand.call(
        current_user: current_user!,
        current_password: current_password,
        new_password: new_password
      ))
    end
  end
end

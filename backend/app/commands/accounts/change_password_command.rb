# frozen_string_literal: true

module Accounts
  # Change the account password (AD-15, FR-30's account half — epic-14 T1).
  # Rules (kickoff delta review, delta decision 2):
  # - the CURRENT password is verified against the stored bcrypt digest
  #   (has_secure_password's #authenticate). A wrong current is an HONEST
  #   FIELD ERROR — VALIDATION_FAILED on the currentPassword field, never an
  #   auth failure: the caller is already authenticated, this is a form
  #   validation outcome.
  # - the NEW password carries the register rule's minimum
  #   (RegisterUserCommand::MIN_PASSWORD_LENGTH, reused — never restated);
  #   it lands bcrypt-hashed through the same password= digesting.
  # - attempts are rate-limited through the login limiter's MECHANISM
  #   (Accounts::LoginRateLimiter, keyed by the account's normalized email —
  #   the credential-guessing throttle is one protection, mirrored here so
  #   every transport gets it; a tripped window is RATE_LIMITED before any
  #   bcrypt work, exactly like login's).
  # - the session SURVIVES: the JWT is stateless (sub = the user uuid, which
  #   does not change) — no re-mint, no revocation list exists or is built
  #   (AD-15's accepted risk, stated on the schema description).
  class ChangePasswordCommand < ApplicationCommand
    option :current_user
    option :current_password
    option :new_password

    def call
      unless LoginRateLimiter.attempt(current_user.email)
        return Failure(:RATE_LIMITED, { message: "too many password-change attempts, try again later" })
      end

      unless current_user.authenticate(current_password.to_s)
        return Failure(:VALIDATION_FAILED, { message: "current password is incorrect",
                                             field: :currentPassword })
      end

      if new_password.to_s.length < RegisterUserCommand::MIN_PASSWORD_LENGTH
        return Failure(:VALIDATION_FAILED, short_password_context)
      end

      current_user.update!(password: new_password.to_s)
      Success(user: current_user)
    end

    private

    def short_password_context
      { message: "password must be at least #{RegisterUserCommand::MIN_PASSWORD_LENGTH} characters",
        field: :newPassword }
    end
  end
end

# frozen_string_literal: true

module Accounts
  # Register a user with email + password (AD-15). Returns Success(user,
  # token) — the minted JWT (Accounts::TokenCodec) is the session credential.
  #
  # Credential validation is command-side by design: the model keeps epic-01's
  # minimal posture (presence + uniqueness only). Rules (epic P2-2 kickoff
  # delta review): email shape via Rails' URI::MailTo::EMAIL_REGEXP, password
  # minimum 8 chars, emails downcased before create, duplicate email →
  # VALIDATION_FAILED (pre-check + RecordNotUnique backstop for the race
  # window between check and INSERT).
  class RegisterUserCommand < ApplicationCommand
    MIN_PASSWORD_LENGTH = 8

    option :email
    option :password

    def call
      normalized = email.to_s.downcase

      unless URI::MailTo::EMAIL_REGEXP.match?(normalized)
        return Failure(:VALIDATION_FAILED, { message: "email is invalid", field: :email })
      end

      if password.to_s.length < MIN_PASSWORD_LENGTH
        return Failure(:VALIDATION_FAILED, short_password_context)
      end

      return duplicate_failure if User.exists?(email: normalized)

      user = User.new(email: normalized, password: password.to_s)
      # A false here is the model-level uniqueness validation losing the race
      # against a concurrent registration; the rescue below is the DB-level
      # arm of the same backstop. Both are the one duplicate-email outcome.
      return duplicate_failure unless user.save

      Success(user: user, token: Accounts::TokenCodec.encode(sub: user.id))
    rescue ActiveRecord::RecordNotUnique
      duplicate_failure
    end

    private

    def short_password_context
      { message: "password must be at least #{MIN_PASSWORD_LENGTH} characters", field: :password }
    end

    def duplicate_failure
      Failure(:VALIDATION_FAILED, { message: "email has already been taken", field: :email })
    end
  end
end

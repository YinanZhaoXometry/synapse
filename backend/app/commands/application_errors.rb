# frozen_string_literal: true

# The closed error enum (AD-12) — the backend's single source of truth for
# error codes. GraphQL error `extensions.code` is one of these, and the web
# mirrors it 1:1 as `AppError.code` (frontend/src/data/errors.ts): adding a
# code touches both sides in the same change (AD-17's one-contract rule).
#
# The api is not user-facing (AD-9): codes travel as-is; human-readable
# English context is carried alongside in ApplicationErrors::Failure#context.
module ApplicationErrors
  # FORBIDDEN is RESERVED, never produced: foreign ids answer uniform
  # NOT_FOUND ("never reveals existence", AD-13) — the one exception a
  # comment in update_plan_command documents explicitly. It stays in the
  # closed enum so the web mirror's vocabulary is stable (epic-17 T10).
  CODES = %i[
    UNAUTHORIZED
    FORBIDDEN
    NOT_FOUND
    VALIDATION_FAILED
    RATE_LIMITED
    CAP_REACHED
    INTERNAL
  ].freeze

  # A typed command failure: the closed-enum `code` plus free-form `context`
  # (ids, field paths, log lines — whatever the resolver/presenter needs).
  # Commands never raise — every domain failure is one of these wrapped in a
  # dry-monads Failure (AD-12).
  Failure = Struct.new(:code, :context, keyword_init: true) do
    def initialize(code:, context: {})
      super(code: code, context: context || {})
    end
  end

  # Raised only when a command passes a code outside CODES to the Failure
  # factory — infrastructure misuse, not a domain outcome, so it deliberately
  # escapes ApplicationCommand.call's never-raise rescue (fail fast at the
  # seam). Being an ArgumentError keeps it recognizable as a programmer error.
  class InvalidCodeError < ArgumentError; end
end

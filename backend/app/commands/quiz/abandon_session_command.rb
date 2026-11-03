# frozen_string_literal: true

module Quiz
  # Exit path (FR-18 story 15) — the Phase-1 quiz-repository
  # abandonQuizSession mirror: an ACTIVE session becomes `abandoned`,
  # terminal and not resumable. No evidence is written (a graded answer only
  # ever lands through RecordEvidenceCommand); already-completed sessions are
  # never demoted.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): unknown and
  # foreign ids are NOT_FOUND (delta 2) where Phase-1's write no-ops them
  # silently, and the command returns the session (the Phase-1 write is void)
  # so the mutation's payload can hand the client the fresh terminal state.
  class AbandonSessionCommand < ApplicationCommand
    option :current_user
    option :session_id

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500).
      return session_not_found unless session_id.to_s.match?(Accounts::UUID_REGEX)
      session = current_user.quiz_sessions.find_by(id: session_id)
      return session_not_found unless session

      session.update!(status: "abandoned") if session.status == "active"
      Success(session: session)
    end

    private

    def session_not_found
      Failure(:NOT_FOUND, { message: "quiz session not found" })
    end
  end
end

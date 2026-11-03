# frozen_string_literal: true

module Mutations
  module Quiz
    # Exit path (FR-18 story 15) — thin per AD-12: parse → authorize
    # (current_user!) → command → map. The terminal-state rule (active only;
    # completed never demoted; no evidence) lives in
    # ::Quiz::AbandonSessionCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class AbandonSession < BaseMutation
      description "Abandon an active quiz session (FR-18 story 15): terminal `abandoned`, no evidence written; a completed session is never demoted. Cross-user ids are NOT_FOUND."

      # The argument is sessionId (the epic P2-3 review, P2-4): the Phase-1
      # repo's abandonQuizSession(sessionId) names the argument after what it
      # addresses — recordEvidence's sessionId already does; `id` was the odd
      # one out on the surface.
      argument :session_id, String,
               required: true,
               description: "The session's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The session in its (possibly unchanged) terminal state."

      def resolve(session_id:)
        command_result(::Quiz::AbandonSessionCommand.call(
          current_user: current_user!,
          session_id: session_id
        ))
      end
    end
  end
end

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

      argument :id, String,
               required: true,
               description: "The session's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The session in its (possibly unchanged) terminal state."

      def resolve(id:)
        command_result(::Quiz::AbandonSessionCommand.call(
          current_user: current_user!,
          session_id: id
        ))
      end
    end
  end
end

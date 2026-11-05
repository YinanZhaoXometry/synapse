# frozen_string_literal: true

module Mutations
  module Quiz
    # retakeQuizSession (FR-42, epic P2-09 T4) — thin per AD-12: parse →
    # authorize (current_user!) → command → map. The COMPLETED-only gate, the
    # scope/mode derivation, and the fresh-uuid generation all live in
    # ::Quiz::RetakeSessionCommand (which rides Ai::GenerateQuizCommand — one
    # cap-counted provider call per retake); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class RetakeSession < BaseMutation
      description "Retake a COMPLETED quiz session (FR-42): a fresh AI generation seeded from the old session's scope + mode — never a replay of its graded answers (NFR-8: the new attempt's evidence lands fresh). Each call mints a NEW session (a server-side uuid) and spends one cap-counted provider call — deliberately NOT idempotent."

      # The argument is sessionId (the abandonQuizSession precedent): the
      # id names what it addresses.
      argument :session_id, String,
               required: true,
               description: "The COMPLETED session's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy). Quiz sessions do not persist their original generation language, so the retake states it explicitly."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The NEW session (status active — the fresh attempt; the old session stays completed)."

      def resolve(session_id:, language:)
        command_result(::Quiz::RetakeSessionCommand.call(
          current_user: current_user!,
          session_id: session_id,
          language: language
        ))
      end
    end
  end
end

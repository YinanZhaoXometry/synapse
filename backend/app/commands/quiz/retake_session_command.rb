# frozen_string_literal: true

module Quiz
  # The hub retake (FR-42, epic P2-09 T4): re-attempt a COMPLETED quiz session.
  # A retake is a NEW generation seeded from the old session's scope + mode —
  # never a replay of the graded answers (NFR-8: the new attempt's evidence
  # lands fresh, one EvidenceRecord per answer on the NEW session, which is
  # already how RecordEvidenceCommand attributes — the shape here simply makes
  # replay-of-answers impossible).
  #
  # The generation discipline stays in ONE place: the command internally calls
  # Ai::GenerateQuizCommand with a server-minted fresh client uuid (a uuid the
  # caller never chose → the delta-3 replay never engages) plus the old
  # session's plan xor task scope, mode, and the caller-stated language — so
  # cap-counting (one provider call), the shape guards, normalization, and the
  # single write path (Quiz::CreateSessionCommand) all apply verbatim. The old
  # session is untouched: terminal `completed` is one-way.
  #
  # Deliberately NOT idempotent: every call is a new attempt and mints another
  # session (the schema description says so on the wire). A failed retake
  # (CAP_REACHED, provider garbage, a since-deleted scope) persists nothing —
  # the inner command writes only after a successful provider reply.
  #
  # Language rides the command rather than the old session: quiz sessions do
  # not persist their generation language (no column), so the retake states it
  # explicitly — the mutation takes it like generateQuiz does (the deviation
  # from the ticket's "derive language from the old session" is recorded in
  # the ticket's ## Comments).
  #
  # Failure surface: session resolution → uniform NOT_FOUND (unknown, foreign,
  # malformed — the AbandonSessionCommand posture); a non-completed session →
  # VALIDATION_FAILED; everything from the inner generation passes through
  # verbatim (VALIDATION_FAILED language / NOT_FOUND a since-deleted scope /
  # CAP_REACHED / INTERNAL).
  class RetakeSessionCommand < ApplicationCommand
    option :current_user
    option :session_id
    option :language

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (the malformed address must not degrade into an INTERNAL 500).
      return session_not_found unless session_id.to_s.match?(Accounts::UUID_REGEX)
      session = current_user.quiz_sessions.find_by(id: session_id)
      return session_not_found unless session
      unless session.status == "completed"
        return Failure(:VALIDATION_FAILED,
                       { message: "only a completed quiz session can be retaken", field: :sessionId })
      end

      Ai::GenerateQuizCommand.call(
        current_user: current_user,
        client_uuid: SecureRandom.uuid,
        mode: session.mode,
        language: language,
        plan_id: session.plan_id,
        task_id: session.task_id
      )
    end

    private

    def session_not_found
      Failure(:NOT_FOUND, { message: "quiz session not found" })
    end
  end
end

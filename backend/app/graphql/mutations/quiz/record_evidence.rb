# frozen_string_literal: true

module Mutations
  module Quiz
    # Record a finished quiz's graded answers — thin per AD-12: parse →
    # authorize (current_user!) → command → map. Every rule (the whole-batch
    # validation + one-transaction write, mistake logging with the derived
    # source locator, session completion, the cross-graph question check)
    # lives in ::Quiz::RecordEvidenceCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class RecordEvidence < BaseMutation
      description "Record a finished quiz's graded answers: one EvidenceRecord per answer (node-attributed off the question, AD-6) and a MistakeEntry per wrong answer (source location + user answer; a forfeit 「看答案」 grades as wrong), in one transaction — the session completes. The only write path that ever moves a Mastery Score (scoring is epic-04's)."

      argument :session_id, String,
               required: true,
               description: "The finished session's uuid. Unknown, foreign, or malformed ids are NOT_FOUND; a non-active session fails VALIDATION_FAILED."

      argument :results, [ Types::QuizAnswerInput ],
               required: true,
               description: "The graded answers (Phase-1 AnswerResult[]). Every result must address a question of this session."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The completed session."

      field :evidence, [ Types::EvidenceRecordType ],
            null: false,
            description: "The EvidenceRecords just written (one per answered question)."

      field :mistakes, [ Types::MistakeEntryType ],
            null: false,
            description: "The MistakeEntries just auto-logged (one per wrong answer)."

      def resolve(session_id:, results:)
        command_result(::Quiz::RecordEvidenceCommand.call(
          current_user: current_user!,
          session_id: session_id,
          results: results.map(&:to_h)
        ))
      end
    end
  end
end

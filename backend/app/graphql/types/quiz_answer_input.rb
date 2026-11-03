# frozen_string_literal: true

module Types
  # One graded answer on a recordEvidence input — the Phase-1 AnswerResult
  # (frontend/src/data/quiz-repository.ts): questionId/outcome/userAnswer/
  # forfeited. A forfeit 「看答案」 is outcome "wrong" with forfeited true.
  # The outcome vocabulary is correct|partial|wrong (ADR-0001's evidence
  # values; scoring is epic-04's).
  class QuizAnswerInput < Types::BaseInputObject
    description "One graded answer of a finished quiz (Phase-1 AnswerResult)."

    argument :question_id, String,
             required: true,
             description: "The answered question's uuid — must belong to the named session (cross-graph ids are VALIDATION_FAILED)."

    argument :outcome, String,
             required: true,
             description: "\"correct\" | \"partial\" | \"wrong\" (a forfeit 「看答案」 grades as wrong)."

    argument :user_answer, String,
             required: true,
             description: "What the user answered (empty for a forfeit)."

    argument :forfeited, Boolean,
             required: true,
             description: "「看答案 = 放弃」: true when the user gave up via show-answer."
  end
end

# frozen_string_literal: true

module Mutations
  module Ai
    # gradeOpenAnswer (AD-5/AD-16, epic P2-5 ticket 03): grade a learner's
    # open answer against the section its question cites — outcome +
    # rationale + optional supporting quote, all produced server-side (the
    # UI renders the contract, never guesses it, NFR-2). A pure computation:
    # the client turns the outcome into evidence via recordEvidence (the
    # Phase-1 shape).
    class GradeOpenAnswer < BaseMutation
      description "Grade an open answer against its question's cited source section — outcome, rationale, optional quote (server-side AI, FR-18/33)."

      argument :question_id, String,
               required: true,
               description: "The open question's uuid (ownership-checked; its keywords and source section drive the grading)."
      argument :answer, String,
               required: true,
               description: "The learner's answer."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."

      field :graded_answer, Types::GradedAnswerType,
            null: false,
            description: "The grade: outcome (correct | partial | wrong), rationale, optional supporting citation."

      def resolve(question_id:, answer:, language:)
        graded = command_result(::Ai::GradeOpenAnswerCommand.call(
          current_user: current_user!,
          question_id: question_id,
          answer: answer,
          language: language
        ))
        { graded_answer: graded }
      end
    end
  end
end

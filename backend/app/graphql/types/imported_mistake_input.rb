# frozen_string_literal: true

module Types
  # One mistake entry of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4/FR-23 — the source location travels with the row).
  class ImportedMistakeInput < Types::BaseInputObject
    description "One mistake entry of a document being imported (Phase-1 MistakeEntry)."

    argument :id, String,
             required: true,
             description: "The mistake entry's client uuid (AD-12) — its key in the idempotent import."

    argument :question_id, String,
             required: true,
             description: "The answered question's uuid."

    argument :session_id, String,
             required: false,
             description: "The grading session's uuid (null when unattributed)."

    argument :node_id, String,
             required: true,
             description: "The attributed node's uuid."

    argument :user_answer, String,
             required: true,
             description: "What the user answered (empty for a forfeit)."

    argument :source_location, Types::ReadingLocatorInput,
             required: true,
             description: "Where in the sourced material the question came from (FR-23)."

    argument :forfeited, Boolean,
             required: false,
             description: "「看答案 = 放弃」: graded wrong, no mastery credit (FR-18). Defaults to false."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the mistake was logged on the client."
  end
end

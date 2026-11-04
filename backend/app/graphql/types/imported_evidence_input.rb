# frozen_string_literal: true

module Types
  # One evidence record of an imported Phase-1 document (epic P2-8 ticket
  # 03; AD-4). createdAt is required data, not garnish: the api's Mastery
  # and streak read evidence created_at, so the import keeps the learner's
  # history on its original clock.
  class ImportedEvidenceInput < Types::BaseInputObject
    description "One evidence record of a document being imported (Phase-1 EvidenceRecord)."

    argument :id, String,
             required: true,
             description: "The evidence record's client uuid (AD-12) — its key in the idempotent import."

    argument :node_id, String,
             required: true,
             description: "The evidenced node's uuid (AD-6)."

    argument :session_id, String,
             required: false,
             description: "The grading session's uuid (null for non-quiz attributions)."

    argument :question_id, String,
             required: false,
             description: "The answered question's uuid (null for non-quiz attributions)."

    argument :outcome, String,
             required: true,
             description: "\"correct\" | \"partial\" | \"wrong\" (ADR-0001's evidence vocabulary)."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the answer was recorded on the client — carried verbatim (Mastery/streak read it)."
  end
end

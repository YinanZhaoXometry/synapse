# frozen_string_literal: true

module Types
  # One plan of an imported Phase-1 document (epic P2-8 ticket 03; AD-4 —
  # the document's shape is the contract). The id is the row's client uuid
  # (AD-12) — the idempotency key for the whole-document import.
  class ImportedPlanInput < Types::BaseInputObject
    description "One plan of a document being imported (Phase-1 StudyPlan)."

    argument :id, String,
             required: true,
             description: "The plan's client uuid (AD-12) — its key in the idempotent import."

    argument :topic, String,
             required: true,
             description: "What the plan studies."

    argument :goal, String,
             required: false,
             description: "The optional study goal."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the plan was created on the client — carried so history keeps its clock."
  end
end

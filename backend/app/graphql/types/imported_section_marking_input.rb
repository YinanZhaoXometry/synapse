# frozen_string_literal: true

module Types
  # One section marking of an imported Phase-1 document (epic P2-8 ticket
  # 03; AD-4/FR-15 — a claim is a claim, never evidence; the claim's history
  # travels with its timestamps).
  class ImportedSectionMarkingInput < Types::BaseInputObject
    description "One section marking of a document being imported (Phase-1 SectionMarking)."

    argument :id, String,
             required: true,
             description: "The marking's client uuid (AD-12) — its key in the idempotent import."

    argument :material_id, String,
             required: true,
             description: "The marked material's uuid."

    argument :section_id, String,
             required: true,
             description: "The marked section's stable id (a MaterialSection id string)."

    argument :claimed_at, Types::DateTime,
             required: false,
             description: "When the claim was made on the client."

    argument :cleared_at, Types::DateTime,
             required: false,
             description: "When the claim was cleared (null while open)."
  end
end

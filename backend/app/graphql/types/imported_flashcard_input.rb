# frozen_string_literal: true

module Types
  # One flashcard of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4). difficulty is the user's self-rating carried over as study-state
  # — it never creates EvidenceRecords (ADR-0001).
  class ImportedFlashcardInput < Types::BaseInputObject
    description "One flashcard of a document being imported (Phase-1 Flashcard)."

    argument :id, String,
             required: true,
             description: "The card's client uuid (AD-12) — its key in the idempotent import."

    argument :material_id, String,
             required: true,
             description: "The deck's material's uuid."

    argument :node_id, String,
             required: false,
             description: "The attributed node's uuid (optional, AD-6)."

    argument :front, String,
             required: true,
             description: "The prompt side."

    argument :back, String,
             required: true,
             description: "The answer side."

    argument :difficulty, String,
             required: false,
             description: "\"hard\" | \"medium\" | \"easy\" | null — the carried self-rating."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the card was created on the client."
  end
end

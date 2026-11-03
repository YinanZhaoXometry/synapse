# frozen_string_literal: true

module Types
  # One card of a createFlashcards input — the Phase-1 FlashcardInput
  # (frontend/src/data/flashcard-repository.ts) plus the client uuid: Phase 1
  # mints card uuids client-side (crypto.randomUUID) with no replay concept;
  # the server needs the id as the per-card idempotency key (kickoff delta 3 —
  # deviation recorded in the ticket Comments).
  class FlashcardInput < Types::BaseInputObject
    description "One card of a deck being persisted (Phase-1 FlashcardInput plus the client uuid — the per-card idempotency key)."

    argument :client_uuid, String,
             required: true,
             description: "Client-supplied card uuid (AD-12) — the per-card idempotency key (a same-user replay returns the existing card)."

    argument :front, String,
             required: true,
             description: "The prompt side."

    argument :back, String,
             required: true,
             description: "The answer side."
  end
end

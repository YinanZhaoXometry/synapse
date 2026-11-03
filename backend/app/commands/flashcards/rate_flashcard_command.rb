# frozen_string_literal: true

module Flashcards
  # The flashcard study-state write — the Phase-1 flashcard-repository
  # rateFlashcard mirror: the user's self-rating persists on the Flashcard row
  # (kickoff delta 5) and NEVER creates EvidenceRecords (ADR-0001: the Mastery
  # Score moves on quiz evidence only; Phase 1 never treats flashcard flips as
  # evidence — frontend/src/domain/entities.ts).
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): unknown and
  # foreign ids are NOT_FOUND (delta 2) where Phase-1 throws a client-local
  # FLASHCARD_NOT_FOUND, and the command returns the updated card (the
  # Phase-1 write is void) so the mutation's payload can hand the client the
  # fresh rating — the SetMaterialParseResultCommand by-id write pattern.
  class RateFlashcardCommand < ApplicationCommand
    option :current_user
    option :id
    option :difficulty

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500).
      return card_not_found unless id.to_s.match?(Accounts::UUID_REGEX)
      card = current_user.flashcards.find_by(id: id)
      return card_not_found unless card

      unless Flashcards::DIFFICULTIES.include?(difficulty.to_s)
        return Failure(:VALIDATION_FAILED, { message: "difficulty is invalid", field: :difficulty })
      end

      card.update!(difficulty: difficulty)
      Success(flashcard: card)
    end

    private

    def card_not_found
      Failure(:NOT_FOUND, { message: "flashcard not found" })
    end
  end
end

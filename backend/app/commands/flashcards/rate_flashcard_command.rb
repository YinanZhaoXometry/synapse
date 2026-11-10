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

      card.update!(difficulty: difficulty, stage: next_stage(card))
      Success(flashcard: card)
    end

    private

    # Epic-31 T2: the stage rides the rating write (the interval ladders'
    # easy-streak counter). Easy climbs ONLY on an easy streak — each ladder
    # restarts at its base, so a climb off a non-easy rating would jump the
    # interval (hard 2d → easy 20d off one rating; Q7 in the epic's
    # delta-grill) — and honors the same-day guard: one rung per UTC day,
    # reading the card's updated_at (the previous rating moment) BEFORE the
    # overwrite. Hard resets; medium holds. The cap matches the ladders'
    # last index; the scan clamps again defensively.
    def next_stage(card)
      case difficulty.to_s
      when "hard"
        0
      when "medium"
        card.stage
      else # easy
        climbs = card.difficulty == "easy" && card.updated_at&.utc&.to_date != Time.current.utc.to_date
        climbs ? [ card.stage + 1, Requeue::FLASHCARD_LADDERS["easy"].length - 1 ].min : card.stage
      end
    end

    def card_not_found
      Failure(:NOT_FOUND, { message: "flashcard not found" })
    end
  end
end

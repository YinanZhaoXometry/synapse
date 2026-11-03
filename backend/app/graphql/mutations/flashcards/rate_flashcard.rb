# frozen_string_literal: true

module Mutations
  module Flashcards
    # The study-state write — thin per AD-12: parse → authorize
    # (current_user!) → command → map. The by-id write and its one law (the
    # difficulty self-rating NEVER creates EvidenceRecords — kickoff delta 5)
    # live in ::Flashcards::RateFlashcardCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class RateFlashcard < BaseMutation
      description "Write a flashcard's difficulty self-rating (hard | medium | easy) — the study-state write. It persists on the card and NEVER creates EvidenceRecords (ADR-0001: the Mastery Score moves on quiz evidence only). Cross-user ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The card's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :difficulty, String,
               required: true,
               description: "\"hard\" | \"medium\" | \"easy\" — the user's self-rating."

      field :flashcard, Types::FlashcardType,
            null: false,
            description: "The card with its fresh rating."

      def resolve(id:, difficulty:)
        command_result(::Flashcards::RateFlashcardCommand.call(
          current_user: current_user!,
          id: id,
          difficulty: difficulty
        ))
      end
    end
  end
end

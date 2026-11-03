# frozen_string_literal: true

module Mutations
  module Flashcards
    # Persist a flashcard deck on a material — thin per AD-12: parse →
    # authorize (current_user!) → command → map. Every rule (the one-
    # transaction batch, per-card idempotent replay, uuid ownership, the
    # material/node addresses) lives in ::Flashcards::CreateFlashcardsCommand;
    # failure mapping lives in Mutations::BaseMutation#command_result via the
    # epic-01 ErrorPresenter.
    class CreateFlashcards < BaseMutation
      description "Persist a flashcard deck on a material (node attribution optional), in one transaction. Idempotent per card on clientUuid: a same-user replay returns the existing cards (a mixed batch creates only the missing ones); a uuid owned by another user fails VALIDATION_FAILED."

      argument :material_id, String,
               required: true,
               description: "The deck's material. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :node_id, String,
               required: false,
               description: "The attributed node (a task's auto-node gives the deck one — AD-6). Unknown or foreign ids are NOT_FOUND."

      argument :cards, [ Types::FlashcardInput ],
               required: true,
               description: "The cards (Phase-1 FlashcardInput[] plus the per-card client uuid)."

      field :cards, [ Types::FlashcardType ],
            null: false,
            description: "The persisted (existing + created) cards, in input order."

      def resolve(material_id:, cards:, node_id: nil)
        command_result(::Flashcards::CreateFlashcardsCommand.call(
          current_user: current_user!,
          material_id: material_id,
          node_id: node_id,
          cards: cards.map(&:to_h)
        ))
      end
    end
  end
end

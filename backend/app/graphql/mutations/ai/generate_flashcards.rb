# frozen_string_literal: true

module Mutations
  module Ai
    # generateFlashcards (FR-19/AD-16, epic P2-5 ticket 03): one card per
    # section, generated server-side from the material's own sections and
    # persisted through Flashcards::CreateFlashcardsCommand (server-minted
    # card uuids; each call is a new generation, bounded by the daily cap).
    class GenerateFlashcards < BaseMutation
      description "Generate a flashcard deck — one card per section of the given material — server-side AI (FR-19/33)."

      argument :material_id, String,
               required: true,
               description: "The material's uuid (ownership-checked)."
      argument :node_id, String,
               required: false,
               description: "The attributed node's uuid (optional, AD-6)."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."

      field :cards, [ Types::FlashcardType ],
            null: false,
            description: "The created deck (one card per usable section)."

      def resolve(material_id:, language:, node_id: nil)
        command_result(::Ai::GenerateFlashcardsCommand.call(
          current_user: current_user!,
          material_id: material_id,
          node_id: node_id,
          language: language
        ))
      end
    end
  end
end

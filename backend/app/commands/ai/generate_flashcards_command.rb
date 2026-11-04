# frozen_string_literal: true

module Ai
  # GenerateFlashcards (FR-19/AD-16, epic P2-5 ticket 03): one material →
  # one card per section, generated from server-assembled context and
  # persisted through Flashcards::CreateFlashcardsCommand (the epic P2-3
  # command is the only write path). The server mints the per-card
  # client_uuids — card-level replay keys are per-generation; the mutation
  # itself is deliberately NOT idempotent (each call is a new generation,
  # bounded by the daily cap).
  class GenerateFlashcardsCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :node_id, optional: true
    option :language

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material

      context = Ai::ContextAssembler.material_scope(material)
      messages = Ai::Prompts.flashcards(language: language, context: context)
      provider = Ai::Provider.complete(user: current_user, messages: messages)
      return provider if provider.failure?

      cards = normalize_cards(provider.value!)
      return Failure(:INTERNAL, { message: "ai flashcard payload had no usable cards" }) if cards.empty?

      Flashcards::CreateFlashcardsCommand.call(
        current_user: current_user,
        material_id: material_id,
        node_id: node_id,
        cards: cards
      )
    end

    private

    # Only usable front/back pairs survive; a missing or empty field drops
    # the card (CreateFlashcardsCommand would refuse the whole batch — one
    # hallucinated half-card must not cost the user their generation).
    def normalize_cards(raw)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return [] unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["cards"] : nil
      return [] unless candidates.is_a?(Array)

      candidates.filter_map do |card|
        next unless card.is_a?(Hash)
        front = card["front"].to_s.strip
        back = card["back"].to_s.strip
        next if front.empty? || back.empty?

        { client_uuid: SecureRandom.uuid, front: front, back: back }
      end
    end
  end
end

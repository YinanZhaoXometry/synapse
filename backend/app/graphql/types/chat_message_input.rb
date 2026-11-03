# frozen_string_literal: true

module Types
  # One message on an appendChatMessage input — the Phase-1 appendChatMessage
  # call shape (frontend/src/data/progress-repository.ts): role/text/
  # citations. No id/createdAt: the server mints both (the Phase-1 client
  # clock never reaches a row).
  class ChatMessageInput < Types::BaseInputObject
    description "One Companion-conversation message (the author side and its grounding citations)."

    argument :role, String,
             required: true,
             description: "\"user\" | \"companion\" — the author."

    argument :text, String,
             required: true,
             description: "The message body."

    argument :citations, [ Types::ReadingLocatorInput ],
             required: true,
             description: "The grounding locators (may be empty)."
  end
end

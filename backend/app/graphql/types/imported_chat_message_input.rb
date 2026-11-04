# frozen_string_literal: true

module Types
  # One Companion-chat message of an imported Phase-1 document (epic P2-8
  # ticket 03; AD-4). The Phase-1 client minted the message ids — they
  # travel verbatim and land in the thread's jsonb exactly as stored.
  class ImportedChatMessageInput < Types::BaseInputObject
    description "One chat message of a document being imported (Phase-1 ChatMessage)."

    argument :id, String,
             required: true,
             description: "The message's client-minted uuid (AD-12) — carried verbatim into the jsonb row."

    argument :role, String,
             required: true,
             description: "\"user\" | \"companion\" — the author."

    argument :text, String,
             required: true,
             description: "The message body."

    argument :citations, [ Types::ReadingLocatorInput ],
             required: false,
             description: "The grounding locators (may be empty)."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the message was written on the client — carried verbatim."
  end
end

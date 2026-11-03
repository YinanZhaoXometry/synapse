# frozen_string_literal: true

module Types
  # One Companion-conversation message — the Phase-1 TS ChatMessage shape
  # (frontend/src/domain/entities.ts) verbatim: id/role/text/citations/
  # createdAt. Messages are the thread's EMBEDDED jsonb rows (the ER has no
  # ChatMessage entity), string-keyed with the TS keys — so the fields read
  # the row's keys explicitly, the MaterialSectionType pattern.
  class ChatMessageType < Types::BaseObject
    description "One message of a material's Companion transcript (AD-2 — citations are ReadingLocators, grounding what the answer used)."

    field :id, String,
          null: false,
          description: "The message's id (server-minted uuid inside the thread's messages jsonb — the Phase-1 client minted it; the server clock owns ids and timestamps now)."

    field :role, String,
          null: false,
          description: "The author: \"user\" | \"companion\"."

    field :text, String,
          null: false,
          description: "The message body."

    field :citations, [ Types::ReadingLocatorType ],
          null: false,
          description: "The grounding locators the answer used (may be empty)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the message was stored (the server clock)."

    def id
      object["id"]
    end

    def role
      object["role"]
    end

    def text
      object["text"]
    end

    def citations
      object["citations"]
    end

    def created_at
      Time.zone.parse(object["createdAt"])
    end
  end
end

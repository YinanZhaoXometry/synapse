# frozen_string_literal: true

module Types
  # The Companion conversation anchored 1:1 to a material (AD-5) — the
  # Phase-1 TS ChatThread shape (frontend/src/domain/entities.ts):
  # materialId/messages/updatedAt, with the messages realized as the
  # thread's embedded jsonb rows (the ER has no ChatMessage entity — epic
  # P2-1 ticket 02's decision). `id` is the server row uuid, a deliberate
  # addition to the TS shape (the KnowledgeNode.createdAt class of
  # deviation — ticket 01's #5): every exposed row carries its addressable
  # id. This type receives the ChatThread ActiveRecord row — its attributes
  # resolve by name; only the row's own timestamps pass through the house
  # DateTime scalar.
  class ChatThreadType < Types::BaseObject
    description "A material's Companion transcript, anchored 1:1 to the material (plan-creation transcripts are ephemeral and live nowhere — AD-5)."

    field :id, String,
          null: false,
          description: "The thread's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The anchored material's uuid (1:1 — unique index)."

    field :messages, [ Types::ChatMessageType ],
          null: false,
          description: "The conversation, in append order."

    field :updated_at, Types::DateTime,
          null: false,
          description: "When the thread last moved (each append touches it — the TS updatedAt)."
  end
end

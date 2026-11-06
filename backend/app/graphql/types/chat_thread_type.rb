# frozen_string_literal: true

module Types
  # The Companion conversation anchored 1:1 to its scope — a material (the
  # Phase-1 TS ChatThread shape, frontend/src/domain/entities.ts:
  # materialId/messages/updatedAt) or a plan (epic-25 T1 — the tutor page's
  # plan-grounded thread; exactly one of the two anchors is set, the
  # chat_threads_one_scope floor, so exactly one of materialId/planId
  # resolves). messages are the thread's embedded jsonb rows (the ER has no
  # ChatMessage entity — epic P2-1 ticket 02's decision). `id` is the server
  # row uuid, a deliberate addition to the TS shape (the
  # KnowledgeNode.createdAt class of deviation — ticket 01's #5): every
  # exposed row carries its addressable id. This type receives the
  # ChatThread ActiveRecord row — its attributes resolve by name; only the
  # row's own timestamps pass through the house DateTime scalar.
  class ChatThreadType < Types::BaseObject
    description "A Companion transcript, anchored 1:1 to its scope — a material (the reader) or a plan (the tutor page, epic-25 T1); exactly one of materialId / planId is set (the chat_threads_one_scope floor)."

    field :id, String,
          null: false,
          description: "The thread's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: true,
          description: "The anchored material's uuid (1:1 — unique index). Null on a plan-scoped thread."

    field :plan_id, String,
          null: true,
          description: "The anchored plan's uuid (1:1 — unique index, epic-25 T1). Null on a material-scoped thread."

    field :messages, [ Types::ChatMessageType ],
          null: false,
          description: "The conversation, in append order."

    field :updated_at, Types::DateTime,
          null: false,
          description: "When the thread last moved (each append touches it — the TS updatedAt)."
  end
end

# frozen_string_literal: true

module Types
  # One Companion transcript of an imported Phase-1 document (epic P2-8
  # ticket 03; AD-4/AD-5 — 1:1 with its material). No id exists on the
  # Phase-1 shape — the thread is keyed by its material; a thread the user
  # already owns is skipped (transcripts are never duplicated or rewritten).
  class ImportedChatThreadInput < Types::BaseInputObject
    description "One chat thread of a document being imported (Phase-1 ChatThread)."

    argument :material_id, String,
             required: true,
             description: "The anchored material's uuid (1:1 — the row's key on the import, as on the api)."

    argument :messages, [ Types::ImportedChatMessageInput ],
             required: false,
             description: "The conversation, in append order, with its client-minted message ids."

    argument :updated_at, Types::DateTime,
             required: false,
             description: "When the thread last moved on the client."
  end
end

# frozen_string_literal: true

module Types
  # The data-export read (FR-30, epic-14 T1; delta decision 1): the caller's
  # WHOLE document as ONE JSON string, in the import's shape verbatim (the
  # DocumentInput wire shape — a client can feed it straight back through
  # importDocument). One string field, not a deep object tree: the payload is
  # big by nature (the whole document), and the consumer Blob-downloads it —
  # a download-shaped string field keeps the wire lean and the client's save
  # path trivial. Never selected piecemeal; always the whole document.
  class ExportDataType < Types::BaseObject
    description "The caller's whole document gathered in the import's shape (AD-4/AD-15), as one JSON string for a client-side download."

    field :document, String,
          null: false,
          description: "The whole document, JSON-serialized: version + the import collections verbatim (plans/nodes/materials/tasks/sessions/questions/evidence/flashcards/mistakes/sectionMarkings/readingProgress/chatThreads). Materials ride byteless (the re-attach invite restores them)."
  end
end

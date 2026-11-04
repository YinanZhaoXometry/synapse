# frozen_string_literal: true

module Types
  # One reading position of an imported Phase-1 document (epic P2-8 ticket
  # 03; AD-4). No id exists on the Phase-1 shape — the row is keyed 1:1 by
  # its material, like saveReadingProgress's upsert; a row the user already
  # owns is skipped (never clobbered by the older snapshot).
  class ImportedReadingProgressInput < Types::BaseInputObject
    description "One reading position of a document being imported (Phase-1 ReadingProgress)."

    argument :material_id, String,
             required: true,
             description: "The read material's uuid (1:1 — the row's key on the import, as on the api)."

    argument :position, Types::ReadingPositionInput,
             required: true,
             description: "The ReadingPosition: locator + extracted text (delta-6 bound)."

    argument :updated_at, Types::DateTime,
             required: false,
             description: "When the position last moved on the client."
  end
end

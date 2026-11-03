# frozen_string_literal: true

module Types
  # Where the reader stopped on a material — the Phase-1 TS ReadingProgress
  # shape (frontend/src/domain/entities.ts): materialId/position/updatedAt,
  # with the position as the jsonb row (Types::ReadingPositionType). `id` is
  # the server row uuid, a deliberate addition to the TS shape (the
  # KnowledgeNode.createdAt class of deviation — ticket 01's #5). This type
  # receives the ReadingProgress ActiveRecord row — its attributes resolve
  # by name.
  class ReadingProgressType < Types::BaseObject
    description "A material's reading position, 1:1 with the material — the continue line (FR-25) reads these."

    field :id, String,
          null: false,
          description: "The progress row's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The read material's uuid (1:1 — unique index)."

    field :position, Types::ReadingPositionType,
          null: false,
          description: "The ReadingPosition (locator + extracted text), stored verbatim with TS keys (AD-2 / kickoff delta 7)."

    field :updated_at, Types::DateTime,
          null: false,
          description: "When the position last moved (each save touches it — the TS updatedAt)."
  end
end

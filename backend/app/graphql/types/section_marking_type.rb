# frozen_string_literal: true

module Types
  # The FR-15 Mastery Marking claim — the Phase-1 TS SectionMarking shape
  # (frontend/src/domain/entities.ts) verbatim:
  # id/materialId/sectionId/claimedAt/clearedAt. A claim, NEVER evidence —
  # it can never move a Mastery Score (ADR-0001: the score moves on quiz
  # evidence only). This type receives the SectionMarking ActiveRecord row —
  # its attributes resolve by name.
  class SectionMarkingType < Types::BaseObject
    description "A Mastery Marking claim on a material section (FR-15) — a claim, never evidence; it can never move a score."

    field :id, String,
          null: false,
          description: "The marking row's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The marked material's uuid."

    field :section_id, String,
          null: false,
          description: "The marked section's stable id (a MaterialSection id string — a slug, not a uuid)."

    field :claimed_at, Types::DateTime,
          null: false,
          description: "When the claim was made (the server clock)."

    field :cleared_at, Types::DateTime,
          null: true,
          description: "When the claim was cleared (null while open — history is preserved, rows are never deleted)."
  end
end

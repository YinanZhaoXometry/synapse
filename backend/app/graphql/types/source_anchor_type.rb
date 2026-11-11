# frozen_string_literal: true

module Types
  # One source anchor of a generated lesson (epic-36 T1, spec decisions 2+3):
  # the (materialId, sectionId) pair naming the source section a lesson
  # chapter was generated from — the reader's jump-to-source vocabulary,
  # server-owned (anchors are written by the lesson engine, never trusted
  # from the client).
  class SourceAnchorType < Types::BaseObject
    description "A lesson chapter's source pointer: the (materialId, sectionId) pair the chapter was generated from (epic-36 — server-owned, never client-trusted)."

    field :material_id, String,
          null: false,
          description: "The source material's uuid."

    field :section_id, String,
          null: false,
          description: "The source section's id on that material (markdown slug or page-N)."

    def material_id
      object["materialId"]
    end

    def section_id
      object["sectionId"]
    end
  end
end

# frozen_string_literal: true

module Types
  # One annotation range on an addAnnotation input — the AD-2 domain range
  # (epic-13 T3 delta 3): the char offsets within the anchor text + the
  # quoted span. Exactly one of sectionId/page rides (xor, agreeing with
  # the locator's kind — the command validates; the wire stays permissive,
  # the NoteTargetingInput posture).
  class AnnotationRangeInput < Types::BaseInputObject
    description "An annotation range (AD-2): char offsets within the anchor text + the quoted span for drift verification."

    argument :section_id, String,
             required: false,
             description: "The markdown section's stable id (required for markdown annotations, forbidden otherwise)."

    argument :page, Int,
             required: false,
             description: "The 1-based pdf page (required for pdf annotations, forbidden otherwise)."

    argument :start, Int,
             required: true,
             description: "The range's first character offset within the anchor text (inclusive, ≥ 0)."

    argument :end, Int,
             required: true,
             description: "The range's end offset within the anchor text (exclusive, ≥ start)."

    argument :quote, String,
             required: true,
             description: "The annotated text verbatim (non-blank)."
  end
end

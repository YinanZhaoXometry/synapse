# frozen_string_literal: true

module Types
  # One distilled Study Focus item (FR-17, epic-13 T4; OQ-1): title +
  # detail + the server-owned deep-link address — `sourceRange` rides the
  # source annotation's range jsonb VERBATIM (the AD-2 shape: sectionId xor
  # page + char offsets + the quote), so the reader jumps AND re-verifies
  # the anchor against the live text. Null sourceRange = a range-less
  # (pre-T3 import) source — the item renders text-only, honestly
  # unlinkable.
  class StudyFocusItemType < Types::BaseObject
    description "One core study item (FR-17): distilled from ONE of the learner's annotations, carrying that annotation's range as the deep-link address (server-owned — the model never echoes an address back)."

    field :id, String,
          null: false,
          description: "The item's uuid — server-minted per generation (the flashcards posture). Ids are plain UUID strings — no GlobalID (AD-12)."

    field :title, String,
          null: false,
          description: "A short item name, grounded in the source annotation."

    field :detail, String,
          null: false,
          description: "One or two sentences explaining the point, distilled from the source annotation."

    field :source_range, GraphQL::Types::JSON,
          null: true,
          description: "The source annotation's range jsonb verbatim (AD-2: sectionId xor page + start/end offsets + the drift-verification quote) — the deep-link shape. Null when the source annotation predates ranges (text-only item)."

    def source_range
      object["sourceRange"]
    end
  end
end

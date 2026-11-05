# frozen_string_literal: true

module Types
  # The AD-2 annotation range (FR-16, epic-13 T3 delta 2) as stored on an
  # Annotation's range jsonb — TS keys verbatim, string-keyed rows the
  # fields read explicitly (the ReadingLocatorType pattern):
  # {sectionId?|page?, start, end, quote} — the char offsets within the
  # anchor text (the markdown section's stable text or the PDF page's
  # text-layer string) + the quoted span for drift verification. Exactly
  # one of sectionId/page rides, per the locator kind (the command's xor
  # law; the other reads null).
  class AnnotationRangeType < Types::BaseObject
    description "Where an annotation sits within its anchor text (AD-2): char offsets + the quoted span for drift verification. A markdown range carries sectionId (page null); a pdf range carries page (sectionId null)."

    field :section_id, String,
          null: true,
          description: "The markdown section's stable id (markdown ranges only)."

    field :page, Int,
          null: true,
          description: "The 1-based pdf page (pdf ranges only)."

    field :start, Int,
          null: false,
          description: "The range's first character offset within the anchor text (inclusive, ≥ 0)."

    field :end, Int,
          null: false,
          resolver_method: :range_end,
          description: "The range's end offset within the anchor text (exclusive, ≥ start)."

    field :quote, String,
          null: false,
          description: "The annotated text verbatim — the drift check: if the anchor text no longer reads this at [start, end), the annotation is stale (rendered honestly, never misplaced)."

    def section_id
      object["sectionId"]
    end

    def page
      object["page"]
    end

    def start
      object["start"]
    end

    # `end` is a Ruby keyword — the field resolves through this alias
    # (graphql-ruby's resolver_method guidance for built-in conflicts).
    def range_end
      object["end"]
    end

    def quote
      object["quote"]
    end
  end
end

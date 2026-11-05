# frozen_string_literal: true

module Types
  # One user annotation (FR-16, epic-13 T3): a highlight or underline on a
  # material, user-scoped (AD-13). The locator (Types::ReadingLocatorType —
  # the flat reader over the shared jsonb shape) names the section/page;
  # the range (Types::AnnotationRangeType, over the range jsonb) pins the
  # char offsets + the quote. `kind`/`color` are enum-ish strings (the
  # vocabulary pinned by the model enum + the DB check floor — the note's
  # scope posture); body is the free-text note (empty for pure highlights,
  # the v2 note editor deferred).
  class AnnotationType < Types::BaseObject
    description "One annotation (FR-16): a highlight or underline pinned by char offsets within a section's (markdown) or page's (pdf) text, with a named color and an optional note."

    field :id, String,
          null: false,
          description: "The annotation's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The annotated material's uuid."

    field :locator, Types::ReadingLocatorType,
          null: false,
          description: "Where in the material the annotation sits: {kind:\"pdf\", page} or {kind:\"markdown\", sectionId} (AD-2)."

    field :range, Types::AnnotationRangeType,
          null: false,
          description: "The char offsets + quoted span within the anchor text (AD-2, delta 3) — the drift-verification shape."

    field :kind, String,
          null: false,
          description: "\"highlight\" | \"underline\"."

    field :color, String,
          null: true,
          description: "A named palette key (coral | amber | emerald | blue); null rides the reader's default."

    field :body, String,
          null: false,
          description: "The free-text note (the v2 editor; empty for pure highlights)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the annotation was added."

    def locator
      object["locator"]
    end

    def range
      object["range"]
    end

    def material_id
      object.material_id
    end
  end
end

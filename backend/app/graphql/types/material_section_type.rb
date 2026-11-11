# frozen_string_literal: true

module Types
  # One extracted section of a material — the Phase-1 TS MaterialSection
  # (frontend/src/domain/entities.ts), verbatim: id/title/text. Sections are
  # stored as the string-keyed jsonb rows the factories pin, so the fields
  # read the row's keys explicitly (no hash-resolution magic).
  class MaterialSectionType < Types::BaseObject
    description "One extracted section of a material (AD-4: the text is bounded per-section)."

    field :id, String,
          null: false,
          description: "The stable section id (markdown slug or `page-N` for PDF) — quiz sourcing and section markings address sections by it."

    field :title, String,
          null: false,
          description: "The section's heading."

    field :text, String,
          null: false,
          description: "The extracted text, bounded per-section (kickoff delta 6: ≤ 100,000 characters)."

    # The source anchors (epic-36 T1, spec decision 3): present ONLY on
    # server-written lesson rows (the stream op writes them) — client-attached
    # sections never carry the key, and the AttachMaterialInput validation
    # shape is unchanged (the client cannot supply anchors).
    field :anchors, [ Types::SourceAnchorType ],
          null: true,
          description: "The source sections this lesson section was generated from (epic-36, server-owned) — null on client-attached sections."

    def id
      object["id"]
    end

    def title
      object["title"]
    end

    def text
      object["text"]
    end

    def anchors
      object["anchors"]
    end
  end
end

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

    def id
      object["id"]
    end

    def title
      object["title"]
    end

    def text
      object["text"]
    end
  end
end

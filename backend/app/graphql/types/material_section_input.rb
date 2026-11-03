# frozen_string_literal: true

module Types
  # One section of a material payload — the Phase-1 MaterialSection mirror
  # (frontend/src/domain/entities.ts): id/title/text. The text is the
  # client's extracted content; the server refuses anything beyond 100,000
  # characters per section (kickoff delta 6) instead of truncating.
  class MaterialSectionInput < Types::BaseInputObject
    description "One extracted section of a material (Phase-1 MaterialSection)."

    argument :id, String,
             required: true,
             description: "The stable section id (markdown slug or `page-N` for PDF)."

    argument :title, String,
             required: true,
             description: "The section's heading."

    argument :text, String,
             required: true,
             description: "The extracted text (at most 100,000 characters per section — kickoff delta 6)."
  end
end

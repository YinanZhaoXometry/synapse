# frozen_string_literal: true

module Types
  # The domain locator (AD-2) as stored on a MistakeEntry's sourceLocation
  # jsonb — TS keys verbatim: {kind:"pdf", page} | {kind:"markdown", sectionId}
  # (string-keyed rows; the fields read the row's keys explicitly, the
  # MaterialSectionType pattern). A pdf locator's sectionId is null and vice
  # versa.
  class ReadingLocatorType < Types::BaseObject
    description "Where in a Material a mistake's source sits (AD-2) — {kind:\"pdf\", page} or {kind:\"markdown\", sectionId}."

    field :kind, String,
          null: false,
          description: "\"pdf\" or \"markdown\"."

    field :page, Int,
          null: true,
          description: "The 1-based pdf page (pdf locators only)."

    field :section_id, String,
          null: true,
          description: "The markdown section's stable id (markdown locators only)."

    def kind
      object["kind"]
    end

    def page
      object["page"]
    end

    def section_id
      object["sectionId"]
    end
  end
end

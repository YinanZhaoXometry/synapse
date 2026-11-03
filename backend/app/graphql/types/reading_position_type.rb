# frozen_string_literal: true

module Types
  # The domain ReadingPosition (AD-2) as stored on a ReadingProgress's
  # position jsonb — TS keys verbatim: {locator, text}, string-keyed rows
  # (the factories pin them), so the fields read the row's keys explicitly
  # (the MaterialSectionType pattern). The locator reuses
  # Types::ReadingLocatorType (the flat reader over the same jsonb row
  # shape).
  class ReadingPositionType < Types::BaseObject
    description "Where the reader stopped: the locator plus the extracted text at it (AD-2 — one shape end to end, CompanionService grounding included)."

    field :locator, Types::ReadingLocatorType,
          null: false,
          description: "The position's locator: {kind:\"pdf\", page} or {kind:\"markdown\", sectionId}."

    field :text, String,
          null: false,
          description: "The extracted text at the position (bounded per-section, kickoff delta 6)."

    def locator
      object["locator"]
    end

    def text
      object["text"]
    end
  end
end

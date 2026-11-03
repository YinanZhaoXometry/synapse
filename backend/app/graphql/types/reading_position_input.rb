# frozen_string_literal: true

module Types
  # The ReadingPosition on a saveReadingProgress input — the Phase-1 domain
  # type verbatim (frontend/src/domain/entities.ts, AD-2 / kickoff delta 7):
  # the locator + the extracted text at it, stored as jsonb with TS keys
  # exactly.
  class ReadingPositionInput < Types::BaseInputObject
    description "A ReadingPosition (AD-2): the locator plus the extracted text at it."

    argument :locator, Types::ReadingLocatorInput,
             required: true,
             description: "Where the position sits: {kind:\"pdf\", page} or {kind:\"markdown\", sectionId}."

    argument :text, String,
             required: true,
             description: "The extracted text at the position (at most 100,000 characters — the delta-6 bound; VALIDATION_FAILED beyond)."
  end
end

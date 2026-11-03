# frozen_string_literal: true

module Types
  # One ReadingLocator on a chat/progress payload — the Phase-1 domain
  # locator (frontend/src/domain/entities.ts), TS keys on the wire (delta 7):
  # {kind:"pdf", page} | {kind:"markdown", sectionId}. The server stores the
  # row verbatim and drops a kind-irrelevant stray key (a markdown locator's
  # page, a pdf locator's sectionId) — the CreateSessionCommand
  # choice-shape normalization mirror.
  class ReadingLocatorInput < Types::BaseInputObject
    description "A ReadingLocator (AD-2): {kind:\"pdf\", page} or {kind:\"markdown\", sectionId}."

    argument :kind, String,
             required: true,
             description: "\"pdf\" or \"markdown\"."

    argument :page, Int,
             required: false,
             description: "The 1-based pdf page (required for pdf locators, ignored otherwise)."

    argument :section_id, String,
             required: false,
             description: "The markdown section's stable id (required for markdown locators, ignored otherwise)."
  end
end

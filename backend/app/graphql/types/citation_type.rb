# frozen_string_literal: true

module Types
  # One supporting citation (AD-5): a ReadingLocator into the material plus
  # the exact supporting sentence, when one matched — the Phase-1 Citation
  # shape (frontend/src/src/ai/types.ts) realized server-side. The locator
  # is built by the command (never trusted from the model or the client).
  class CitationType < Types::BaseObject
    description "A grounding citation: a ReadingLocator plus the supporting sentence when one matched (AD-5 — the UI renders the contract)."

    field :locator, Types::ReadingLocatorType,
          null: false,
          description: "Where in the material the support lives."

    field :quote, String,
          null: true,
          description: "The exact supporting sentence (null when none applies)."

    def locator
      object.locator
    end

    def quote
      object.quote
    end
  end
end

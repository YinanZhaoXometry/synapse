# frozen_string_literal: true

module Types
  # One structured enrichment marker inside a Note (FR-40, epic P2-12 T1,
  # delta decision 1's markers-only v1): the model decides WHERE a visual
  # aids understanding and emits [[enrich|kind|suggestion]] markers; the
  # command extracts them into the note's enrichment array while the body
  # keeps them verbatim (export preserves them). The "user" kind rides the
  # user-requested annotation (the enrichAt input), not the model's choice.
  class NoteMarkerType < Types::BaseObject
    description "One enrichment placement marker (delta decision 1 — markers-only v1): where a visual should go and what it should show. No assets are stored in v1 — the view renders placeholder cards."

    field :kind, String,
          null: false,
          description: "The marker's kind: \"diagram\" | \"chart\" | \"image\" from the model, \"user\" for a user-requested annotation."

    field :suggestion, String,
          null: false,
          description: "What the visual should show (the model's grounded suggestion, or the user's free text)."
  end
end

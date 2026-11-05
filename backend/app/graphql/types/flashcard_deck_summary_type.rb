# frozen_string_literal: true

module Types
  # One deck row on the flashcardDecksHub read model (FR-41, epic P2-09 T1,
  # delta decision 4): one row per material that has flashcards, grouped
  # server-side — the web renders the aggregate deck view, never stitches
  # (AD-14). createdAt is the deck MATERIAL's timestamp (decision recorded in
  # the ticket's ## Comments).
  class FlashcardDeckSummaryType < Types::BaseObject
    description "One deck on the flashcard hub (FR-41): a material that has flashcards, its plan/task links, and the card count — grouped server-side."

    field :material_id, String,
          null: false,
          description: "The deck material's uuid — the study-flow link."

    field :material_title, String,
          null: false,
          description: "The deck material's title."

    field :plan_id, String,
          null: true,
          description: "The plan the material is attached to (null on unattached/task materials)."

    field :plan_title, String,
          null: true,
          description: "The attached plan's topic title (null with the plan)."

    field :task_id, String,
          null: true,
          description: "The Study Task owning the material (null on plan-side materials)."

    field :card_count, Int,
          null: false,
          description: "How many flashcards the material's deck carries."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the deck material was created (the deck's own timestamp)."
  end
end

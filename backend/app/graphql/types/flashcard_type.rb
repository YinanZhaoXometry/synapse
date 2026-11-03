# frozen_string_literal: true

module Types
  # A flashcard — the Phase-1 TS Flashcard shape verbatim:
  # id/materialId/nodeId/front/back/difficulty/createdAt. difficulty is the
  # user's SELF-rating and never creates EvidenceRecords (kickoff delta 5;
  # ADR-0001: the Mastery Score moves on quiz evidence only).
  class FlashcardType < Types::BaseObject
    description "A flashcard seeded from a material; its difficulty is the user's self-rating — never evidence."

    field :id, String,
          null: false,
          description: "The card's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The sourced material's uuid."

    field :node_id, String,
          null: true,
          description: "The attributed node's uuid (optional; a task's auto-node gives its deck one — AD-6)."

    field :front, String,
          null: false,
          description: "The prompt side."

    field :back, String,
          null: false,
          description: "The answer side."

    field :difficulty, String,
          null: true,
          description: "The self-rating: \"hard\" | \"medium\" | \"easy\" — null until the user rates the card. Study-state, never evidence."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the card was created."
  end
end

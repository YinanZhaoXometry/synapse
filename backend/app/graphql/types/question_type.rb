# frozen_string_literal: true

module Types
  # One quiz question — the Phase-1 TS Question shape
  # (frontend/src/domain/entities.ts), verbatim: id/sessionId/nodeId/kind/
  # prompt/options/correctOptionIndex/sourceMaterialId/sourceSectionId/
  # keywords/explanation. nodeId is the attribution stamped at generation
  # time (AD-6 — required); the source pair is the materials-sourced
  # provenance (FR-18/NFR-1). options/keywords are jsonb arrays round-tripping
  # verbatim (plain string arrays).
  class QuestionType < Types::BaseObject
    description "One quiz question: node-attributed at generation time (AD-6), strictly materials-sourced (FR-18/NFR-1)."

    field :id, String,
          null: false,
          description: "The question's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :session_id, String,
          null: false,
          description: "The owning quiz session's uuid."

    field :node_id, String,
          null: false,
          description: "The attributed node's uuid (AD-6 — attribution happens at generation time)."

    field :kind, String,
          null: false,
          description: "\"open\" or \"choice\" (Quiz = Open + Choice, and Mix over both)."

    field :prompt, String,
          null: false,
          description: "The question text."

    field :options, [ String ],
          null: true,
          description: "The choice options (choice questions only; single-select in Phase 1)."

    field :correct_option_index, Int,
          null: true,
          description: "The correct option's index (choice questions only)."

    field :source_material_id, String,
          null: false,
          description: "The sourced material's uuid (FR-18/NFR-1 provenance)."

    field :source_section_id, String,
          null: false,
          description: "The sourced section's stable id — a MaterialSection id string (markdown slug or `page-N`), addressable through the material's sections."

    field :keywords, [ String ],
          null: true,
          description: "The open-answer grading keywords (the simulated adapter contract, AD-5)."

    field :explanation, String,
          null: false,
          description: "The answer explanation."
  end
end

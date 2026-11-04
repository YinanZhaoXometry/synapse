# frozen_string_literal: true

module Types
  # One question of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4/AD-6 — node attribution at generation time, materials-sourced
  # provenance). The session must be carried by the same document; the
  # question's id must appear in that session's questionIds (its position
  # reads off it).
  class ImportedQuestionInput < Types::BaseInputObject
    description "One question of a document being imported (Phase-1 Question)."

    argument :id, String,
             required: true,
             description: "The question's client uuid (AD-12) — its key in the idempotent import."

    argument :session_id, String,
             required: true,
             description: "The owning session's uuid — must name a session of the same document."

    argument :node_id, String,
             required: true,
             description: "The attributed node's uuid (AD-6 — attribution travels with the row)."

    argument :kind, String,
             required: true,
             description: "\"open\" or \"choice\"."

    argument :prompt, String,
             required: true,
             description: "The question text."

    argument :options, [ String ],
             required: false,
             description: "The choice options (choice questions only)."

    argument :correct_option_index, Int,
             required: false,
             description: "The correct option's index (choice questions only)."

    argument :source_material_id, String,
             required: true,
             description: "The sourced material's uuid (FR-18/NFR-1 provenance)."

    argument :source_section_id, String,
             required: true,
             description: "The sourced section's stable id."

    argument :keywords, [ String ],
             required: false,
             description: "The open-answer grading keywords (the simulated adapter's contract, carried as data)."

    argument :explanation, String,
             required: true,
             description: "The answer explanation."
  end
end

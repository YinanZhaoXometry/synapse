# frozen_string_literal: true

module Types
  # One generated question on a createQuizSession input — the Phase-1
  # QuestionInput (frontend/src/data/quiz-repository.ts): nodeId is REQUIRED
  # on every question (AD-6 — attribution at generation time; targeted
  # generation stays epic-10), and the source pair is the materials-sourced
  # provenance. options/correctOptionIndex belong to choice questions (an
  # open question's are normalized away server-side); keywords belong to open
  # questions (the grading contract).
  class QuizQuestionInput < Types::BaseInputObject
    description "One generated question with its node attribution (AD-6 — required) and materials-sourced provenance (Phase-1 QuestionInput)."

    argument :node_id, String,
             required: true,
             description: "The attributed node's uuid (AD-6 — required on every question). Unknown or foreign ids are NOT_FOUND."

    argument :kind, String,
             required: true,
             description: "\"open\" or \"choice\"."

    argument :prompt, String,
             required: true,
             description: "The question text."

    argument :options, [ String ],
             required: false,
             description: "The choice options (choice questions need at least two)."

    argument :correct_option_index, Int,
             required: false,
             description: "The correct option's index, in range (choice questions only)."

    argument :source_material_id, String,
             required: true,
             description: "The sourced material's uuid (FR-18/NFR-1). Unknown or foreign ids are NOT_FOUND."

    argument :source_section_id, String,
             required: true,
             description: "The sourced section's stable id (a MaterialSection id string — the provenance chain FR-18)."

    argument :keywords, [ String ],
             required: false,
             description: "The open-answer grading keywords (the simulated adapter contract, AD-5)."

    argument :explanation, String,
             required: true,
             description: "The answer explanation."
  end
end

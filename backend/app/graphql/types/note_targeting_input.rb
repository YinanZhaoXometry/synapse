# frozen_string_literal: true

module Types
  # Weak-spot targeting on note generation (FR-22, epic P2-12 T2) — strictly
  # a selection/weighting input over the existing materials-sourced note
  # pipeline (FR-40, NFR-1), never a new AI surface (AD-16). Present biases a
  # PLAN-scope generation with the server-computed weak-spot coverage plan
  # (FR-21's targeting layer — the quiz targeting's single source, epic P2-10
  # T5); node/material scopes refuse it (the bias needs a node set), and so
  # does any mode other than "weakSpot" (or a blank/missing one — the command
  # validates, the wire stays permissive).
  class NoteTargetingInput < Types::BaseInputObject
    description "Weak-spot targeting (FR-22): present with mode \"weakSpot\" → the plan-scope note biases toward the learner's weak nodes (the server-computed coverage plan); node/material scopes refuse it (VALIDATION_FAILED)."

    argument :mode, String,
             required: false,
             description: "The targeting mode — only \"weakSpot\" exists (FR-22). Present with any other value, blank, or omitted is refused (VALIDATION_FAILED)."
  end
end

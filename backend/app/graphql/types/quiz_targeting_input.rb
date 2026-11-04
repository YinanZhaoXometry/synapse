# frozen_string_literal: true

module Types
  # Adaptive weak-spot targeting on quiz generation (FR-21, epic P2-10 T5) —
  # strictly a selection/weighting input over the existing materials-sourced
  # pipeline (FR-18), never a new AI surface (AD-16). Present without a node
  # id (`{}`) biases a PLAN-scope generation with the server-computed
  # weak-spot quota plan (Ai::Targeting's recorded delta-grill weights); a
  # node id scopes the generation to that plan node (the node Quick Test —
  # xor planId/taskId, task nodes refused).
  class QuizTargetingInput < Types::BaseInputObject
    description "Adaptive weak-spot targeting (FR-21): present without nodeId → weak-spot quotas over the plan scope; nodeId set → the node Quick Test scope (xor planId/taskId)."

    argument :node_id, String,
             required: false,
             description: "A PLAN node's uuid — the Quick Test scope. A task node's id is refused (a task quiz already has its scope)."
  end
end
